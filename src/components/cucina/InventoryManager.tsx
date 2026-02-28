"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { FaEdit, FaTrash, FaPlus, FaSearch, FaDownload } from "react-icons/fa";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { toPng } from 'html-to-image';
import { Html5QrcodeScanner } from 'html5-qrcode';


interface InventoryBatch {
  expiration_date: string | null;
  supplier: string | null;
  created_at: string;
  quantity_remaining: number;
  quantity_initial: number;
}

type InventoryItem = {
  id: string; // ID of the raw_material or preparation
  inventory_id: string; // ID of the inventory record
  name: string;
  category: "raw_material" | "prepped";
  quantity: number;
  unit: string;
  minStock: number; // For now assuming 0 if not present, or added to tables later but raw_materials has it.
  isActive: boolean;
  trafficLightStatus?: 'green' | 'yellow' | 'red'; // Optional as it's mainly for preparations
  nextExpiry?: string;
  lastSupplier?: string;
  batches?: InventoryBatch[]; // Store batch details
  areaName?: string; // New field for "Gestione Totale"
};

export const InventoryManager: React.FC<{ station: string }> = ({ station }) => {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filter, setFilter] = useState<'raw_material' | 'prepped'>('prepped');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [trafficLightFilter, setTrafficLightFilter] = useState<'all' | 'green' | 'yellow' | 'red'>('all'); // RESTORED
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentAreaId, setCurrentAreaId] = useState<string | null>(null);
  const [allAreas, setAllAreas] = useState<{id: string, name: string}[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");

  const canEdit = currentAreaId ? hasPermission.canEditAreaInventory(currentAreaId) : (station === 'totale' ? (hasPermission.canManageSystem() || user?.global_role === 'head_chef') : false);
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null); // Clear previous errors
    try {
        let areaId: string | null = null;
        
        // 1. Get Area ID unless "totale"
        if (station !== 'totale') {
            const { data: areaData, error: areaError } = await supabase
                .from('areas')
                .select('id')
                .ilike('slug', station) // Case insensitive match
                .single();

            if (areaError || !areaData) {
                console.error("Area not found", areaError);
                setErrorMsg(`Area '${station}' non trovata. Controlla il database.`);
                setItems([]);
                setLoading(false);
                return;
            }
            areaId = areaData.id;
            setCurrentAreaId(areaId);
        } else {
            setCurrentAreaId(null);
        }

        let fetchedItems: InventoryItem[] = [];

        if (filter === 'prepped') {
            // Fetch Preparations
            let query = supabase
                .from('inventory_preparations')
                .select(`
                    id,
                    quantity,
                    status_traffic_light, 
                    area:areas(name),
                    preparation:preparations (
                        id,
                        name,
                        storage_unit,
                        is_active
                    )
                `);
            
            if (areaId) {
                query = query.eq('area_id', areaId);
            }

            const { data, error } = await query;
            
            if (error) {
                throw new Error(`Errore Preparazioni: ${error.message}`);
            }

            if (data) {
                // Define structure for joined preparation data
                interface PreparationJoin {
                    id: string;
                    quantity: number;
                    status_traffic_light: 'green' | 'yellow' | 'red';
                    area?: { name: string };
                    preparation: {
                        id: string;
                        name: string;
                        storage_unit: string;
                        is_active: boolean;
                    };
                }

                // Ensure correct typing
                fetchedItems = (data as unknown as PreparationJoin[]).map((item) => ({ 
                    id: item.preparation.id, 
                    inventory_id: item.id, 
                    name: item.preparation.name, 
                    category: 'prepped', 
                    quantity: item.quantity, 
                    unit: item.preparation.storage_unit || 'unid', 
                    minStock: 0, // min_stock does not exist
                    isActive: item.preparation.is_active, 
                    trafficLightStatus: item.status_traffic_light || 'green', // Now fetching real status
                    areaName: item.area?.name
                }));
            }
        } else {
            // Fetch Raw Materials
            let query = supabase
                .from('inventory_raw')
                .select(`
                    id,
                    quantity,
                    area:areas(name),
                    material:raw_materials (
                        id,
                        name,
                        unit,
                        min_stock_alert,
                        is_active
                    ),
                    batches:inventory_batches(
                        expiration_date,
                        supplier,
                        created_at,
                        quantity_remaining,
                        quantity_initial
                    )
                `);

            if (areaId) {
                query = query.eq('area_id', areaId);
            }

            const { data, error } = await query;

            if (error) {
                throw new Error(`Errore Materie Prime: ${error.message}`);
            }

            if (data) {
                // Define structure for joined raw material data
                interface RawMaterialJoin {
                    id: string;
                    quantity: number;
                    area?: { name: string };
                    material: {
                         id: string;
                         name: string;
                         unit: string;
                         min_stock_alert: number;
                         is_active: boolean;
                    };
                    batches: InventoryBatch[];
                }

                fetchedItems = (data as unknown as RawMaterialJoin[]).map((item) => {
                    // Calculate Expiry and Supplier
                    let nextExpiry = '-';
                    let lastSupplier = '-';
                    
                    if (item.batches && item.batches.length > 0) {
                        const batches = item.batches;
                        // Filter batches with remaining quantity > 0 (optional, but logical)
                        // const activeBatches = item.batches.filter((b: any) => b.quantity_remaining > 0);
                        // actually we want to see info even if 0 maybe? No, usually active stock.
                        // Let's use all batches for history or just active? 
                        // For "Next Expiry", only active batches matter.
                        const activeBatches = batches.filter((b) => b.quantity_remaining > 0);
                        
                        if (activeBatches.length > 0) {
                            // Sort by expiration date ascending for expiry
                            // Sort by expiration date ascending for expiry
                            const withExpiry = activeBatches.filter((b) => b.expiration_date);
                            if (withExpiry.length > 0) {
                                withExpiry.sort((a, b) => new Date(a.expiration_date!).getTime() - new Date(b.expiration_date!).getTime());
                                nextExpiry = withExpiry[0].expiration_date!;
                            }

                             // Sort by created_at descending for supplier (most recent)
                             activeBatches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                             const withSupplier = activeBatches.find((b) => b.supplier);
                             if (withSupplier) lastSupplier = withSupplier.supplier!;
                        }
                    }

                    return {
                        id: item.material.id,
                        inventory_id: item.id,
                        name: item.material.name,
                        category: 'raw_material',
                        quantity: item.quantity,
                        unit: item.material.unit,
                        minStock: item.material.min_stock_alert || 0,
                        isActive: item.material.is_active,
                        nextExpiry,
                        lastSupplier,
                        batches: item.batches, // Pass distinct batches
                        areaName: item.area?.name
                    };
                });
            }
        }

        // Sort items alphabetically to prevent list jumping on reload
        fetchedItems.sort((a, b) => a.name.localeCompare(b.name));

        setItems(fetchedItems);

    } catch (err: unknown) {
        console.error("Error fetching inventory:", err);
        const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
        setErrorMsg(`Errore di caricamento: ${errorMessage}`);
    } finally {
        setLoading(false);
    }
  }, [station, filter, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch kitchen-only areas for "Totale" selection
  useEffect(() => {
    const fetchKitchenAreas = async () => {
        // 1. First get the Cocina parent area ID
        const { data: kitchenParent } = await supabase
            .from('areas')
            .select('id')
            .eq('slug', 'cocina')
            .single();

        if (kitchenParent) {
            // 2. Fetch only child areas of Cocina
            const { data } = await supabase
                .from('areas')
                .select('id, name')
                .eq('parent_id', kitchenParent.id)
                .order('name');
            if (data) setAllAreas(data);
        } else {
            // Fallback if hierarchy is not set: Fetch all and exclude non-kitchen departments
            const { data } = await supabase
                .from('areas')
                .select('id, name')
                .not('slug', 'in', '("sala","locale","bar","cocina")')
                .order('name');
            if (data) setAllAreas(data);
        }
    };
    fetchKitchenAreas();
  }, [supabase]);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = 
        statusFilter === 'all' ? true :
        statusFilter === 'active' ? item.isActive :
        !item.isActive;

    // Traffic Light Filtering RESTORED
    let matchesTrafficLight = true;
    if (trafficLightFilter !== 'all') {
        if (filter === 'prepped') {
             // Use the fetched status
             matchesTrafficLight = item.trafficLightStatus === trafficLightFilter;
        } else {
             // For raw materials, calculate status on the fly
             const status = getStockStatus(item.quantity, item.minStock);
             matchesTrafficLight = status === trafficLightFilter;
        }
    }

    return matchesSearch && matchesStatus && matchesTrafficLight;
  });

  // Helper to determine traffic light status
  const getStockStatus = (quantity: number, minStock: number) => {
    if (quantity <= minStock) return 'red';
    if (quantity <= minStock * 1.2) return 'yellow';
    return 'green';
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'edit' | 'delete' | 'create'>('edit');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState(""); // Add state for unit editing

  // New Item State
  // New Item / Entry State
  const [newItemName, setNewItemName] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("Pezzo");
  const [newItemBarcode, setNewItemBarcode] = useState("");
  const [newEntryQty, setNewEntryQty] = useState<number>(1);
  const [newItemSupplier, setNewItemSupplier] = useState("");
  const [newEntryExpiry, setNewEntryExpiry] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [suggestions, setSuggestions] = useState<{ id: string; name: string; unit: string; code: string }[]>([]); // Search suggestions
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Removed duplicate state declarations

  
  // Expanded Row State for Batches
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleRow = (itemId: string) => {
    if (expandedRow === itemId) {
        setExpandedRow(null);
    } else {
        setExpandedRow(itemId);
    }
  };

  // Scanner Ref
  const scannerRef = React.useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (showScanner && !scannerRef.current) {
         const onScanSuccess = (decodedText: string) => {
             setNewItemBarcode(decodedText);
             // Auto-search if item exists with this barcode?
             // For now just fill the input
             setShowScanner(false);
             if (scannerRef.current) scannerRef.current.clear();
         };
         const scanner = new Html5QrcodeScanner("reader-main", { fps: 10, qrbox: 250 }, false);
         scanner.render(onScanSuccess, (err) => console.warn(err));
         scannerRef.current = scanner;
    }
    return () => {
        if (!showScanner && scannerRef.current) {
            scannerRef.current.clear().catch(console.error);
            scannerRef.current = null;
        }
    };
  }, [showScanner]);



  // Function to update Traffic Light Status (for Preparations only)
  const updateTrafficLight = async (id: string, inventoryId: string, newStatus: 'green' | 'yellow' | 'red') => {
    setItems(currentItems => 
        currentItems.map(item => 
            item.id === id ? { ...item, trafficLightStatus: newStatus } : item
        )
    );

    try {
        const { error } = await supabase
            .from('inventory_preparations')
            .update({ status_traffic_light: newStatus })
            .eq('id', inventoryId);

        if (error) throw error;
    } catch (err) {
        console.error("Error updating status:", err);
        fetchData(); 
    }
  };

  // Open Modal for Deletion
  const handleDeleteClick = (item: InventoryItem) => {
    setSelectedItem(item);
    setModalType('delete');
    setIsModalOpen(true);
  };

  // Open Modal for Editing
  const handleEditClick = (item: InventoryItem) => {
    setSelectedItem(item);
    setEditName(item.name);
    setEditUnit(item.unit); // Initialize with current unit
    setModalType('edit');
    setIsModalOpen(true);
  };

  // Open Modal for Creation
  const handleCreateClick = () => {
    setNewItemName("");
    setNewItemUnit("Pezzo");
    setNewItemBarcode("");
    setNewItemSupplier("");
    setNewEntryQty(1);
    setNewEntryExpiry("");
    setSuggestions([]);
    setShowSuggestions(false);
    setShowScanner(false);
    setModalType('create');
    
    // Set initial selected area if not in "totale"
    if (currentAreaId) {
        setSelectedAreaId(currentAreaId);
    } else {
        setSelectedAreaId("");
    }
    
    setIsModalOpen(true);
  };

  // Confirm Action from Modal
  const confirmModalAction = async () => {
    // Standard checks for edit/delete
    if ((modalType === 'edit' || modalType === 'delete') && !selectedItem) return;

    if (modalType === 'delete') {
        if (!selectedItem) return;
        try {
            // 1. Delete the inventory link first (this station)
            const inventoryTable = filter === 'prepped' ? 'inventory_preparations' : 'inventory_raw';
            const { error: invError } = await supabase
                .from(inventoryTable)
                .delete()
                .eq('id', selectedItem.inventory_id);

            if (invError) throw invError;

            // 2. ATTEMPT HARD DELETE of the Master Record
            const masterTable = filter === 'prepped' ? 'preparations' : 'raw_materials';
            
            const { error: masterError } = await supabase
                .from(masterTable)
                .delete()
                .eq('id', selectedItem.id);

            if (masterError) {
                console.warn("Could not delete master record (likely used elsewhere):", masterError);
            } else {
                 console.log("Master record deleted successfully.");
            }
            
            // Optimistic update
            setItems(prev => prev.filter(i => i.inventory_id !== selectedItem!.inventory_id));
            setIsModalOpen(false);
            
        } catch (err: unknown) {
            const error = err as Error;
            console.error("Error deleting item:", error);
            showToast("Errore durante l'eliminazione: " + error.message, 'error');
        }
    } else if (modalType === 'edit') {
        if (!selectedItem) return;
        // Check if ANYTHING changed (name OR unit)
        const hasNameChanged = editName && editName !== selectedItem.name;
        const hasUnitChanged = filter === 'raw_material' && editUnit && editUnit !== selectedItem.unit;

        if (!hasNameChanged && !hasUnitChanged) {
            setIsModalOpen(false);
            return;
        }

        try {
            const table = filter === 'prepped' ? 'preparations' : 'raw_materials';
            const payload: { name: string; unit?: string } = { name: editName };
            if (filter === 'raw_material') payload.unit = editUnit; // Update unit if raw material
            
            const { error } = await supabase
                .from(table)
                .update(payload)
                .eq('id', selectedItem.id);

            if (error) throw error;

            // Optimistic update
            setItems(prev => prev.map(i => i.id === selectedItem!.id ? { ...i, name: editName, unit: editUnit || i.unit } : i));
            setIsModalOpen(false);

        } catch (err: unknown) {
            const error = err as Error;
            console.error("Error updating name:", error);
            showToast("Errore durante la modifica: " + error.message, 'error');
        }
    } else if (modalType === 'create') {
        if (!newItemName && !newItemBarcode) return;

        try {
            // 1. Get Area ID
            let areaIdToUse = "";
            
            if (station !== 'totale') {
                const { data: areaData, error: areaError } = await supabase
                    .from('areas')
                    .select('id')
                    .ilike('slug', station)
                    .single();
                if (areaError || !areaData) throw new Error("Area not found");
                areaIdToUse = areaData.id;
            } else {
                if (!selectedAreaId) {
                    showToast("Per favore selecciona un'area di destinazione.", 'error');
                    return;
                }
                areaIdToUse = selectedAreaId;
            }

            let masterId: string;
            let inventoryId: string;
            let isNewItem = false;

            // 2. CHECK IF ITEM EXISTS (by Barcode or Name)
            // Strategy: Check Raw Materials first
            let existingItem = null;
            
            if (newItemBarcode) {
                const { data } = await supabase.from('raw_materials').select('id, name').eq('code', newItemBarcode).single();
                // Also check aliases? For MVP check main code.
                existingItem = data;
            }
            
            if (!existingItem && newItemName) {
                 const { data } = await supabase.from('raw_materials').select('id, name').ilike('name', newItemName).single();
                 existingItem = data;
            }

            if (existingItem) {
                // ITEM EXISTS -> Just link or get inventory ID
                masterId = existingItem.id;

                // CRITICAL: Update the master record with the new unit if provided
                // This fix ensures that if I select "Confezione" for an existing item that was "Pezzo", it updates!
                if (filter === 'raw_material' && newItemUnit) {
                     await supabase
                        .from('raw_materials')
                        .update({ unit: newItemUnit })
                        .eq('id', masterId);
                }
                
                // Get Inventory Link
                const { data: invData } = await supabase
                    .from('inventory_raw')
                    .select('id, quantity')
                    .eq('area_id', areaIdToUse)
                    .eq('material_id', masterId)
                    .single();

                if (invData) {
                    inventoryId = invData.id;
                } else {
                    // Start link if not exists in this station (but exists correctly in DB)
                     const { data: newInv } = await supabase
                        .from('inventory_raw')
                        .insert({ area_id: areaIdToUse, material_id: masterId, quantity: 0 })
                        .select().single();
                     if (!newInv) throw new Error("Failed to link inventory");
                     inventoryId = newInv.id;
                }
            } else {
                // CREATE NEW MASTER RECORD
                isNewItem = true;
                const masterTable = filter === 'prepped' ? 'preparations' : 'raw_materials';
                const payload: { name: string; storage_unit?: string; unit?: string; code?: string } = { name: newItemName || "Nuovo Prodotto" };
                
                if (filter === 'prepped') {
                    payload.storage_unit = newItemUnit;
                } else {
                    payload.unit = newItemUnit; // Use the state variable which holds 'Confezione' or whatever is selected
                    if (newItemBarcode) payload.code = newItemBarcode; // Save barcode
                }

                const { data: globalItem, error: masterError } = await supabase
                    .from(masterTable)
                    .insert(payload)
                    .select()
                    .single();

                if (masterError) throw masterError;
                masterId = globalItem.id;

                // Create Inventory Link
                const inventoryTable = filter === 'prepped' ? 'inventory_preparations' : 'inventory_raw';
                 const { data: invItem, error: invError } = await supabase
                    .from(inventoryTable)
                    .insert({
                        area_id: areaIdToUse,
                        ...(filter === 'prepped' ? { preparation_id: masterId } : { material_id: masterId }),
                        quantity: 0
                    })
                    .select()
                    .single();
                if (invError) throw invError;
                inventoryId = invItem.id;
            }

            // 3. LOG ENTRY & BATCH (Only for Raw Material Flow)
            if (filter === 'raw_material') {
                // Create Batch
                const { data: batch } = await supabase.from('inventory_batches').insert({
                    inventory_id: inventoryId,
                    batch_code: `IN-${Date.now().toString().slice(-6)}`,
                    quantity_remaining: newEntryQty,
                    quantity_initial: newEntryQty, // Track initial quantity
                    expiration_date: newEntryExpiry || null,
                    supplier: newItemSupplier || null,
                }).select().single();

                // Log Movement
                if (batch) {
                    await supabase.from('inventory_movements').insert({
                        inventory_id: inventoryId,
                        change_amount: newEntryQty,
                        movement_type: 'IN',
                        current_stock_after: 0, // Trigger handles calculation usually
                        reason: isNewItem ? 'Nuovo Prodotto' : 'Rifornimento',
                        batch_id: batch.id
                    });
                }
                
                // Update Total (Client side calc or DB trigger)
                // Fetch fresh qty
                const { data: freshInv } = await supabase.from('inventory_raw').select('quantity').eq('id', inventoryId).single();
                const currentQty = freshInv?.quantity || 0;
                await supabase.from('inventory_raw').update({ quantity: currentQty + newEntryQty }).eq('id', inventoryId);
            }

            // 4. Refresh & Close
            fetchData();
            setIsModalOpen(false);
            showToast(isNewItem ? "Prodotto creato e aggiunto!" : "Stock aggiornato con successo!", 'success');

        } catch (err: unknown) {
             const error = err as Error;
             console.error("Error creating item:", error);
            showToast("Errore operazione: " + error.message, 'error');
        }
    }
  };



  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewItemName(value);

    // Debounce search
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (value.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
        const table = filter === 'prepped' ? 'preparations' : 'raw_materials';
        const { data, error } = await supabase
            .from(table)
            .select('id, name, unit, code') // Adjust fields based on table
            .ilike('name', `%${value}%`)
            .limit(5);

        if (!error && data) {
            // Map consistent fields
            const mapped = data.map((d: { id: string; name: string; unit?: string; storage_unit?: string; code?: string }) => ({
                id: d.id,
                name: d.name,
                unit: d.unit || d.storage_unit || 'Pezzo',
                code: d.code || ''
            }));
            setSuggestions(mapped as { id: string; name: string; unit: string; code: string }[]);
            setShowSuggestions(true);
        }
    }, 300);
  };

  const selectSuggestion = (item: { id: string; name: string; unit?: string; code?: string }) => {
    setNewItemName(item.name);
    // Only set unit if it exists, otherwise keep current selection (which defaults to Pezzo but can be changed)
    if (item.unit) setNewItemUnit(item.unit);
    if (item.code) setNewItemBarcode(item.code);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleExportImage = async () => {
    // Debug alert to confirm click
    // alert("Generando imagen... Espere un momento."); 
    const element = document.getElementById('inventory-table-snapshot');
    if (!element) {
        alert("Error: No se encuentra la tabla para capturar (ID missing).");
        return;
    }
    try {
        const dataUrl = await toPng(element, { 
            cacheBust: true, 
            // Removed backgroundColor to respect current theme (WYSIWYG)
            style: {
                overflow: 'visible', // Ensure full table is captured even if scrolled
                height: 'auto',
                maxHeight: 'none'
            }
        });
        const link = document.createElement("a");
        link.download = `inventario_${station}_${new Date().toISOString().split('T')[0]}.png`;
        link.href = dataUrl;
        link.click();
        console.log("Image exported successfully");
    } catch (err: unknown) {
        console.error("Error creating image:", err);
        const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
        alert(`Errore dettagliato: ${errorMessage}`);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
      
      {/* Header controls & Toolbar - UNCHANGED */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Inventario: {station}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Gestisci Materie Prime e Preparazioni.</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setFilter('prepped')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${filter === 'prepped' ? 'bg-success-50 text-success-600 dark:bg-success-900/20 dark:text-success-400' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'}`}
            >
                Preparazioni
            </button>
            <button 
                onClick={() => setFilter('raw_material')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${filter === 'raw_material' ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'}`}
            >
                Materie Prime
            </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mx-5 mt-4">
            {errorMsg}
        </div>
      )}

      <div className="p-4 bg-gray-50 dark:bg-gray-700/30 flex flex-col lg:flex-row gap-3 items-start lg:items-center">
        <div className="relative w-full lg:max-w-md">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
                type="text" 
                placeholder="Cerca item..." 
                className="w-full pl-9 pr-4 py-2 text-sm border-gray-200 rounded-lg focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
        </div>
        
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'active' | 'inactive' | 'all')}
                className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 focus:border-brand-500 focus:ring-brand-500 flex-1 sm:flex-none"
            >
                <option value="active">Solo Attivi</option>
                <option value="inactive">Solo Inattivi</option>
                <option value="all">Tutti</option>
            </select>

            <select
                value={trafficLightFilter}
                onChange={(e) => setTrafficLightFilter(e.target.value as 'all' | 'green' | 'yellow' | 'red')}
                className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 focus:border-brand-500 focus:ring-brand-500 flex-1 sm:flex-none"
            >
                <option value="all">Tutti gli Stati</option>
                <option value="green">🟢 Disponibile</option>
                <option value="yellow">🟡 Basso</option>
                <option value="red">🔴 Urgente</option>
            </select>

             <button 
                onClick={handleExportImage}
                title="Scarica Report Immagine"
                className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors border border-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600 sm:w-auto"
            >
                <FaDownload />
            </button>
        </div>

        {canEdit && (
            <button 
                onClick={handleCreateClick}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm ml-auto"
            >
                <FaPlus />
                <span>Aggiungi / Crea</span>
            </button>
        )}
      </div>

      {/* Table */}
      <div id="inventory-table-snapshot" className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg">
        <table className="min-w-full w-full text-left text-sm text-gray-500 dark:text-gray-400">
          <thead className="bg-gray-100 dark:bg-gray-900 text-xs uppercase text-gray-700 dark:text-gray-300">
            <tr>
              <th className="px-6 py-4 font-bold border-b border-gray-200 dark:border-gray-700 whitespace-nowrap">Nome Item</th>
              {station === 'totale' && (
                  <th className="px-6 py-4 font-bold border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center">Area</th>
              )}
              <th className="px-6 py-4 font-bold border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center">
                  {filter === 'prepped' ? 'Stato Preparazione' : 'Stato Stock'}
              </th>
              <th className="px-6 py-4 font-bold border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center">Attivo?</th>
              {filter === 'raw_material' && (
                <th className="px-6 py-4 font-bold border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center">
                  Quantità
                </th>
              )}
              {filter === 'raw_material' && (
                <th className="px-6 py-4 font-bold border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center">Minimo</th>
              )}
              {filter === 'raw_material' && (
                  <>
                    <th className="px-6 py-4 font-bold border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center">Fornitore</th>
                    <th className="px-6 py-4 font-bold border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center">Scadenza</th>
                  </>
              )}
              <th className="px-6 py-4 font-bold border-b border-gray-200 dark:border-gray-700 text-right whitespace-nowrap">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
                 <tr>
                    <td colSpan={station === 'totale' ? 10 : 9} className="px-6 py-12 text-center text-gray-400">
                        Caricamento inventario...
                    </td>
                </tr>
            ) : filteredItems.length > 0 ? filteredItems.map((item) => {
                const status = filter === 'raw_material' ? getStockStatus(item.quantity, item.minStock) : null;
                
                return (
                  <React.Fragment key={item.id}>
                  <tr className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group ${!item.isActive ? 'opacity-60 bg-gray-50 dark:bg-gray-800/50' : ''}`}>
                    <td 
                        className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap max-w-[200px] truncate cursor-pointer hover:text-brand-600 underline decoration-dotted underline-offset-4" 
                        title="Clicca per vedere i lotti"
                        onClick={() => filter === 'raw_material' && toggleRow(item.id)}
                    >
                        {item.name}
                        {filter === 'raw_material' && item.batches && item.batches.length > 0 && (
                            <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">
                                {item.batches.filter((b) => b.quantity_remaining > 0).length} Lotti
                            </span>
                        )}
                    </td>
                    
                    {/* AREA COLUMN (Gestione Totale) */}
                    {station === 'totale' && (
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-brand-600 dark:text-brand-400 uppercase tracking-wider text-[10px]">
                            {item.areaName || '-'}
                        </td>
                    )}
                    
                    {/* STATUS COLUMN */}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                        {filter === 'prepped' ? (
                            // TRAFFIC LIGHT FOR PREPARATIONS
                            <div className={`flex items-center justify-center gap-2 ${!canEdit ? 'pointer-events-none' : ''}`}>
                                <button 
                                    onClick={() => updateTrafficLight(item.id, item.inventory_id, 'green')}
                                    disabled={!canEdit}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                        item.trafficLightStatus === 'green' 
                                        ? 'bg-green-500 text-white shadow-lg scale-110 ring-2 ring-green-200 dark:ring-green-900' 
                                        : 'bg-green-100 text-green-300 dark:bg-green-900/20 dark:text-green-800 hover:bg-green-200'
                                    } ${!canEdit ? 'cursor-default grayscale-[0.5]' : ''}`}
                                    title={canEdit ? "Disponibile" : `Stato: ${item.trafficLightStatus}`}
                                >
                                    <div className={`w-3 h-3 rounded-full bg-current`} />
                                </button>
                                <button 
                                    onClick={() => updateTrafficLight(item.id, item.inventory_id, 'yellow')}
                                    disabled={!canEdit}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                        item.trafficLightStatus === 'yellow' 
                                        ? 'bg-yellow-500 text-white shadow-lg scale-110 ring-2 ring-yellow-200 dark:ring-yellow-900' 
                                        : 'bg-yellow-100 text-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-800 hover:bg-yellow-200'
                                    } ${!canEdit ? 'cursor-default grayscale-[0.5]' : ''}`}
                                    title={canEdit ? "In Esaurimento" : `Stato: ${item.trafficLightStatus}`}
                                >
                                    <div className={`w-3 h-3 rounded-full bg-current`} />
                                </button>
                                <button 
                                    onClick={() => updateTrafficLight(item.id, item.inventory_id, 'red')}
                                    disabled={!canEdit}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                        item.trafficLightStatus === 'red' 
                                        ? 'bg-red-500 text-white shadow-lg scale-110 ring-2 ring-red-200 dark:ring-red-900' 
                                        : 'bg-red-100 text-red-300 dark:bg-red-900/20 dark:text-red-800 hover:bg-red-200'
                                    } ${!canEdit ? 'cursor-default grayscale-[0.5]' : ''}`}
                                    title={canEdit ? "Da Preparare" : `Stato: ${item.trafficLightStatus}`}
                                >
                                    <div className={`w-3 h-3 rounded-full bg-current`} />
                                </button>
                            </div>
                        ) : (
                            // STOCK STATUS FOR RAW MATERIALS
                            <div className="flex items-center justify-center gap-2">
                                {status === 'red' && <span className="w-3 h-3 rounded-full bg-red-500" title="Critico" />}
                                {status === 'yellow' && <span className="w-3 h-3 rounded-full bg-yellow-500" title="Basso" />}
                                {status === 'green' && <span className="w-3 h-3 rounded-full bg-green-500" title="Ok" />}
                            </div>
                        )}
                    </td>

                    {/* ACTIVE STATUS */}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                         {item.isActive ? (
                            <div className="h-2.5 w-2.5 rounded-full bg-blue-500 mx-auto" title="Attivo"></div>
                         ) : (
                            <div className="h-2.5 w-2.5 rounded-full bg-gray-300 mx-auto" title="Inattivo"></div>
                         )}
                    </td>

                    {/* QUANTITY (Only for Raw Materials) */}
                    {filter === 'raw_material' && (
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="font-bold text-gray-900 dark:text-white text-lg">
                                {item.quantity} <span className="text-xs font-normal text-gray-500 lowercase">{item.unit}</span>
                            </span>
                        </td>
                    )}

                    {/* MIN STOCK (Only for Raw Materials) */}
                    {filter === 'raw_material' && (
                        <td className="px-6 py-4 text-gray-400 text-center whitespace-nowrap">
                            {item.minStock > 0 ? item.minStock : '-'}
                        </td>
                    )}
                    
                    {filter === 'raw_material' && (
                        <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center">
                                {item.lastSupplier || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                {item.nextExpiry !== '-' ? (
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        new Date(item.nextExpiry!) < new Date() ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' : 
                                        new Date(item.nextExpiry!) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' : 
                                        'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                    }`}>
                                        {new Date(item.nextExpiry!).toLocaleDateString()}
                                    </span>
                                ) : '-'}
                            </td>
                        </>
                    )}

                    <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {canEdit && (
                                <>
                                    <button 
                                        onClick={() => handleEditClick(item)}
                                        className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors dark:bg-blue-900/20 dark:text-blue-400"
                                    >
                                        <FaEdit className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteClick(item)}
                                        className="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors dark:bg-red-900/20 dark:text-red-400"
                                    >
                                        <FaTrash className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                        </div>
                    </td>
                  </tr>

                  {/* EXPANDED ROW FOR BATCH DETAILS */}
                  {filter === 'raw_material' && expandedRow === item.id && (
                      <tr className="bg-gray-50 dark:bg-gray-800/50 animate-fadeIn">
                          <td colSpan={station === 'totale' ? 10 : 9} className="px-6 py-4">
                              <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-inner border border-gray-100 dark:border-gray-700">
                                  
                                  {item.batches && item.batches.length > 0 ? (
                                      <div className="overflow-x-auto">
                                          <table className="w-full text-xs text-left">
                                              <thead className="text-gray-500 bg-gray-50 dark:bg-gray-800 uppercase font-medium">
                                                  <tr>
                                                      <th className="px-3 py-2">Data Entrata</th> {/* Earliest entry date */}
                                                      <th className="px-3 py-2">Fornitore</th>
                                                      <th className="px-3 py-2">Scadenza</th>
                                                      <th className="px-3 py-2 text-center">Originale</th>
                                                      <th className="px-3 py-2 text-right">Residua</th>
                                                  </tr>
                                              </thead>
                                              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                  {(() => {
                                                      // CONSOLIDATE BATCHES LOGIC
                                                      const groups: Record<string, InventoryBatch & { count: number; total_initial: number; total_remaining: number; earliest_entry: string }> = {};
                                                      
                                                      item.batches?.forEach((b) => {
                                                          // Create unique key based on Expiry + Supplier
                                                          const key = `${b.expiration_date || 'N/D'}-${b.supplier || 'N/D'}`;
                                                          
                                                          if (!groups[key]) {
                                                              groups[key] = {
                                                                  ...b,
                                                                  count: 1,
                                                                  total_initial: b.quantity_initial || b.quantity_remaining, // Fallback for old records
                                                                  total_remaining: b.quantity_remaining,
                                                                  earliest_entry: b.created_at
                                                              };
                                                          } else {
                                                              groups[key].total_initial += (b.quantity_initial || b.quantity_remaining);
                                                              groups[key].total_remaining += b.quantity_remaining;
                                                              // Keep earliest entry date
                                                              if (new Date(b.created_at) < new Date(groups[key].earliest_entry)) {
                                                                  groups[key].earliest_entry = b.created_at;
                                                              }
                                                          }
                                                      });

                                                      const groupedBatches = Object.values(groups);

                                                      return groupedBatches
                                                        .sort((a, b) => new Date(a.expiration_date || '9999-12-31').getTime() - new Date(b.expiration_date || '9999-12-31').getTime())
                                                        .map((batch, idx) => (
                                                          <tr key={idx} className={`${batch.total_remaining === 0 ? 'opacity-40 grayscale' : ''}`}>
                                                              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                                                  {new Date(batch.earliest_entry).toLocaleDateString()}
                                                              </td>
                                                              <td className="px-3 py-2 text-gray-800 dark:text-gray-200 font-medium">
                                                                  {batch.supplier || '-'}
                                                              </td>
                                                              <td className="px-3 py-2">
                                                                  {batch.expiration_date ? (
                                                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                          new Date(batch.expiration_date) < new Date() ? 'bg-red-100 text-red-700' :
                                                                          new Date(batch.expiration_date) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) ? 'bg-yellow-100 text-yellow-700' :
                                                                          'bg-green-100 text-green-700'
                                                                      }`}>
                                                                          {new Date(batch.expiration_date).toLocaleDateString()}
                                                                      </span>
                                                                  ) : (
                                                                      <span className="text-gray-400 italic">N/D</span>
                                                                  )}
                                                              </td>
                                                              <td className="px-3 py-2 text-center text-gray-500">
                                                                  {batch.total_initial} {item.unit}
                                                              </td>
                                                              <td className="px-3 py-2 text-right font-bold text-gray-700 dark:text-gray-300">
                                                                  {batch.total_remaining} {item.unit}
                                                              </td>
                                                          </tr>
                                                      ));
                                                  })()}
                                              </tbody>
                                          </table>
                                      </div>
                                  ) : (
                                      <p className="text-sm text-gray-500 italic">Nessun dettaglio lotti disponibile.</p>
                                  )}
                              </div>
                          </td>
                      </tr>
                  )}
                  </React.Fragment>
                );
            }) : (
                <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                        Nessun item trovato.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>


      {/* MODERN MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        {modalType === 'edit' ? 'Modifica Nome Item' : modalType === 'create' ? 'Nuovo Item' : 'Elimina Item'}
                    </h3>
                    
                    {modalType === 'edit' ? (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Stai modificando il nome dell&apos;articolo originale. <br/>
                                <span className="text-blue-600 dark:text-blue-400 font-medium">ℹ️ Nota:</span> La modifica verrà applicata a tutte le <strong>linee</strong> che utilizzano questo prodotto.
                            </p>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nome</label>
                                <input 
                                    type="text" 
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                    autoFocus
                                />
                            </div>
                            
                            {filter === 'raw_material' && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Unità</label>
                                    <select
                                        value={editUnit}
                                        onChange={(e) => setEditUnit(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                    >
                                        <option value="Pezzo">Pezzo</option>
                                        <option value="Litro">Litro</option>
                                        <option value="Kg">Kg</option>
                                        <option value="Porzione">Porzione</option>
                                        <option value="Vaschetta">Vaschetta</option>
                                        <option value="Pacco">Pacco</option>
                                        <option value="Confezione">Confezione</option>
                                        <option value="Barattolo">Barattolo</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    ) : modalType === 'create' ? (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {filter === 'prepped' 
                                    ? "Aggiungi una nuova preparazione alla lista." 
                                    : "Registra ingresso merce o crea nuovo prodotto."}
                            </p>

                            {station === 'totale' && (
                                <div className="bg-brand-50 dark:bg-brand-900/10 p-3 rounded-lg border border-brand-100 dark:border-brand-900/30">
                                    <label className="block text-xs font-bold text-brand-700 dark:text-brand-400 mb-2 uppercase tracking-wider">Area de Destino</label>
                                    <select
                                        value={selectedAreaId}
                                        onChange={(e) => setSelectedAreaId(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-brand-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-brand-500 outline-none"
                                    >
                                        <option value="">Selecciona area...</option>
                                        {allAreas.map(a => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            
                            {filter === 'raw_material' && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800 mb-4">
                                     <label className="block text-xs font-bold text-blue-800 dark:text-blue-300 mb-2">🔍 Barcode / Scansione</label>
                                     <div className="flex gap-2 mb-2">
                                        <input 
                                            type="text" 
                                            placeholder="EAN Code..." 
                                            value={newItemBarcode}
                                            onChange={(e) => setNewItemBarcode(e.target.value)}
                                            className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border rounded-lg font-mono"
                                        />
                                        <button 
                                            onClick={() => setShowScanner(!showScanner)}
                                            className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 rounded-lg"
                                        >
                                            📷
                                        </button>
                                     </div>
                                     {showScanner && (
                                         <div id="reader-main" className="overflow-hidden rounded-lg border border-gray-300"></div>
                                     )}
                                </div>
                            )}

                            <div className="relative">
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nome Prodotto</label>
                                <input 
                                    type="text" 
                                    placeholder="Es. Salsa Pomodoro, Farina 00..."
                                    value={newItemName}
                                    onChange={handleNameChange}
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                    autoFocus
                                    autoComplete="off"
                                />
                                {showSuggestions && suggestions.length > 0 && (
                                    <ul className="absolute z-10 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                                        {suggestions.map((s) => (
                                            <li 
                                                key={s.id}
                                                onClick={() => selectSuggestion(s)}
                                                className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200 flex justify-between items-center"
                                            >
                                                <span>{s.name}</span>
                                                <span className="text-xs text-gray-400">{s.unit}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Unità</label>
                                    <select
                                        value={newItemUnit}
                                        onChange={(e) => setNewItemUnit(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                    >
                                        <option value="Pezzo">Pezzo</option>
                                        <option value="Litro">Litro</option>
                                        <option value="Kg">Kg</option>
                                        <option value="Porzione">Porzione</option>
                                        <option value="Vaschetta">Vaschetta</option>
                                        <option value="Pacco">Pacco</option>
                                        <option value="Confezione">Confezione</option>
                                        <option value="Barattolo">Barattolo</option>
                                    </select>
                                </div>
                                {filter === 'raw_material' && (
                                    <div>
                                        <label className="block text-xs font-medium text-green-700 dark:text-green-400 mb-1">Quantità Entrata (+)</label>
                                        <input 
                                            type="number" 
                                            value={newEntryQty}
                                            onChange={(e) => setNewEntryQty(parseFloat(e.target.value))}
                                            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border-2 border-green-500/20 rounded-lg text-gray-900 dark:text-white font-bold"
                                        />
                                    </div>
                                )}
                            </div>
                            
                            {filter === 'raw_material' && (
                                <div className="grid grid-cols-2 gap-3 mt-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Fornitore (Opzionale)</label>
                                        <input 
                                            type="text" 
                                            placeholder="Es. Ortofrutta Mario"
                                            value={newItemSupplier}
                                            onChange={(e) => setNewItemSupplier(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Scadenza (Opzionale)</label>
                                        <input 
                                            type="date" 
                                            value={newEntryExpiry}
                                            onChange={(e) => setNewEntryExpiry(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
                                <FaTrash /> Eliminazione totale e definitiva.
                            </p>
                            <p className="text-xs text-gray-500">
                                L&apos;elemento verrà rimosso da <strong>questa lista</strong>. Se non è utilizzato in altre stazioni, verrà eliminato anche dal <strong>Master Record</strong>.
                            </p>
                        </div>
                    )}

                    <div className="mt-6 flex gap-3 justify-end">
                        <button 
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            Annulla
                        </button>
                        <button 
                            onClick={confirmModalAction}
                            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm ${
                                modalType === 'delete' 
                                ? 'bg-red-600 hover:bg-red-700' 
                                : 'bg-brand-600 hover:bg-brand-700'
                            }`}
                        >
                            {modalType === 'delete' ? 'Elimina' : modalType === 'create' ? 'Conferma Entrata' : 'Salva Modifiche'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

        {/* Removed STOCK CONTROL MODAL standalone component for simplification request */}
    </div>
  );
};
