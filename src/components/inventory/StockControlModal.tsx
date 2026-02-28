"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/context/ToastContext';
import { FaBarcode, FaBoxOpen, FaPlus, FaTrash } from 'react-icons/fa';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    item: {
        id: string; // Master ID (raw_material id)
        inventory_id: string; // Inventory link ID
        name: string;
        unit: string;
    } | null;
    stationId: string; // To log moves
    onUpdate: () => void; // Refresh parent
}

interface Batch {
    id: string;
    batch_code: string;
    quantity_remaining: number;
    expiration_date: string | null;
    entry_date: string;
}

interface BarcodeAlias {
    id: string;
    barcode: string;
    description: string;
    quantity_in_unit: number;
}

export const StockControlModal: React.FC<Props> = ({ isOpen, onClose, item, onUpdate }) => {
    const supabase = createClient();
    const { showToast } = useToast();
    const [subTab, setSubTab] = useState<'overview' | 'batches' | 'barcodes' | 'scanner'>('overview');
    const [batches, setBatches] = useState<Batch[]>([]);
    const [aliases, setAliases] = useState<BarcodeAlias[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Scanner State
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    // New Batch State
    const [newBatchQty, setNewBatchQty] = useState<number>(0);
    const [newBatchExpiry, setNewBatchExpiry] = useState<string>("");
    const [newBatchCode, setNewBatchCode] = useState<string>("");

    // Barcode State
    const [newBarcode, setNewBarcode] = useState("");
    const [newBarcodeQty, setNewBarcodeQty] = useState(1);

    const fetchDetails = React.useCallback(async () => {
        if (!item) return;
        setLoading(true);
        
        // Fetch Batches
        const { data: batchData } = await supabase
            .from('inventory_batches')
            .select('*')
            .eq('inventory_id', item.inventory_id) // Batches are linked to inventory line
            .gt('quantity_remaining', 0)
            .order('expiration_date', { ascending: true }); // FIFO: Expiring first
        
        if (batchData) setBatches(batchData);

        // Fetch Barcodes (Aliases)
        const { data: aliasData } = await supabase
            .from('raw_material_aliases')
            .select('*')
            .eq('material_id', item.id); // Aliases are linked to master item
        
        if (aliasData) setAliases(aliasData);
        
        setLoading(false);
    }, [item, supabase]);

    useEffect(() => {
        if (isOpen && item) {
            fetchDetails();
        }
    }, [isOpen, item, fetchDetails]);

    // Cleanup scanner logic moved to effect below where it's used or general cleanup
    useEffect(() => {
        return () => {
             if (scannerRef.current) {
                scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
            }
        };
    }, []);

    const handleAddBatch = async () => {
        if (!item || newBatchQty <= 0) return;
        
        try {
            // 1. Create Batch
            const { data: batch, error } = await supabase
                .from('inventory_batches')
                .insert({
                    inventory_id: item.inventory_id,
                    batch_code: newBatchCode || `L-${Date.now().toString().slice(-6)}`,
                    quantity_remaining: newBatchQty,
                    expiration_date: newBatchExpiry || null
                })
                .select()
                .single();

            if (error) throw error;

            // 2. Log Movement (IN)
            await supabase.from('inventory_movements').insert({
                inventory_id: item.inventory_id,
                change_amount: newBatchQty,
                current_stock_after: 0, // Trigger will calculate or we fetch? For now simple log.
                movement_type: 'IN',
                reason: 'Compra / Ingresso Manuale',
                batch_id: batch.id
            });

            // 3. Update Total Quantity in Inventory
            // We should ideally use a stored procedure or trigger, but for now client-side update
            // Fetch current qty first to be safe
            const { data: currentInv } = await supabase.from('inventory_raw').select('quantity').eq('id', item.inventory_id).single();
            const newTotal = (currentInv?.quantity || 0) + newBatchQty;

            await supabase.from('inventory_raw').update({ quantity: newTotal }).eq('id', item.inventory_id);

            // Reset & Refresh
            setNewBatchQty(0);
            setNewBatchCode("");
            setNewBatchExpiry("");
            fetchDetails();
            onUpdate();
            showToast("Lotto aggiunto con successo!", 'success');

        } catch (err: unknown) {
            const error = err as Error;
            showToast("Errore: " + error.message, 'error');
        }
    };

    const handleAddBarcode = async () => {
        if (!item || !newBarcode) return;
        const { error } = await supabase.from('raw_material_aliases').insert({
            material_id: item.id,
            barcode: newBarcode,
            quantity_in_unit: newBarcodeQty,
            description: `${item.name} (${newBarcodeQty} ${item.unit})`
        });
        if (error) showToast("Errore: " + error.message, 'error');
        else {
            setNewBarcode("");
            fetchDetails();
        }
    };

    // Scanner Logic
    useEffect(() => {
        if (subTab === 'scanner' && !scannerRef.current) {
             // Config
             const config = { fps: 10, qrbox: { width: 250, height: 250 } };
             
             // Callback
             const onScanSuccess = (decodedText: string) => {
                 setNewBarcode(decodedText); // Auto-fill barcode input
                 setSubTab('barcodes'); // Go to barcode tab to assign
                 // Stop scanning
                 if (scannerRef.current) {
                     scannerRef.current.clear();
                 }
             };

             const scanner = new Html5QrcodeScanner("reader", config, false);
             scanner.render(onScanSuccess, (err) => console.warn(err));
             scannerRef.current = scanner;
        }

        return () => {
            // Cleanup provided by previous useEffect return
        };
    }, [subTab]);


    if (!isOpen || !item) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 dark:border-gray-800 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                             <FaBoxOpen className="text-brand-500" />
                             Gestione Stock: {item.name}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Aggiungi entrate, gestisci lotti e codici a barre.
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 dark:border-gray-800">
                    <button 
                        onClick={() => setSubTab('overview')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${subTab === 'overview' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50/50 dark:bg-brand-900/10' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Panoramica
                    </button>
                    <button 
                         onClick={() => setSubTab('batches')}
                         className={`flex-1 py-3 text-sm font-medium transition-colors ${subTab === 'batches' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50/50 dark:bg-brand-900/10' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Lotti & Scadenze
                    </button>
                    <button 
                         onClick={() => setSubTab('barcodes')}
                         className={`flex-1 py-3 text-sm font-medium transition-colors ${subTab === 'barcodes' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50/50 dark:bg-brand-900/10' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Codici a Barre
                    </button>
                     <button 
                         onClick={() => setSubTab('scanner')}
                         className={`flex-1 py-3 text-sm font-medium transition-colors ${subTab === 'scanner' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50/50 dark:bg-brand-900/10' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Scanner 📷
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900/50">
                    
                    {loading && <p className="text-center text-gray-500 py-4">Caricamento dati...</p>}

                    {!loading && subTab === 'overview' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                    <p className="text-xs text-gray-500 uppercase font-semibold">Totale Disponibile</p>
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                                        {batches.reduce((acc, b) => acc + b.quantity_remaining, 0)} <span className="text-base font-normal text-gray-400">{item.unit}</span>
                                    </p>
                                    <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                                        <FaPlus /> {batches.length} Lotti attivi
                                    </p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                    <p className="text-xs text-gray-500 uppercase font-semibold">Prossima Scadenza</p>
                                    <p className="text-xl font-bold text-red-600 mt-1">
                                        {batches[0]?.expiration_date ? new Date(batches[0].expiration_date).toLocaleDateString() : 'Nessuna'}
                                    </p>
                                    {batches[0] && (
                                        <p className="text-xs text-gray-400 mt-2">
                                            Lotto: {batches[0].batch_code}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex gap-3 items-start border border-blue-100 dark:border-blue-900">
                                <span className="text-xl">💡</span>
                                <div className="text-sm text-blue-800 dark:text-blue-200">
                                    <p className="font-semibold mb-1">Lo sapevi?</p>
                                    <p>Puoi assegnare più codici a barre a questo prodotto (es. Sacco 5kg, Pacco 1kg) nella scheda &quot;Codici a Barre&quot;.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {!loading && subTab === 'batches' && (
                        <div className="space-y-6">
                            {/* Add Batch Form */}
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                    <FaPlus className="text-green-500" /> Nuova Entrata (Acquisto)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <input 
                                        type="number" 
                                        placeholder={`Quantità (${item.unit})`}
                                        className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border rounded-lg text-sm"
                                        value={newBatchQty || ''}
                                        onChange={e => setNewBatchQty(parseFloat(e.target.value))}
                                    />
                                    <input 
                                        type="date" 
                                        className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border rounded-lg text-sm"
                                        title="Scadenza"
                                        value={newBatchExpiry}
                                        onChange={e => setNewBatchExpiry(e.target.value)}
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Cod. Lotto (Opz)"
                                        className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border rounded-lg text-sm"
                                        value={newBatchCode}
                                        onChange={e => setNewBatchCode(e.target.value)}
                                    />
                                </div>
                                <button 
                                    onClick={handleAddBatch}
                                    className="w-full mt-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                                >
                                    Conferma Entrata
                                </button>
                            </div>

                            {/* Batch List */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase ml-1">Lotti Attivi</h4>
                                {batches.length === 0 ? (
                                    <p className="text-center text-sm text-gray-400 py-4 italic">Nessun lotto attivo.</p>
                                ) : (
                                    batches.map(batch => (
                                        <div key={batch.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 hover:shadow-sm transition-shadow">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {batch.quantity_remaining} {item.unit}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    Lotto: {batch.batch_code || 'N/A'} • Entrato: {new Date(batch.entry_date).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-sm font-medium ${
                                                    !batch.expiration_date ? 'text-gray-400' :
                                                    new Date(batch.expiration_date) < new Date() ? 'text-red-500' : 
                                                    'text-green-600'
                                                }`}>
                                                    {batch.expiration_date ? `Scade: ${new Date(batch.expiration_date).toLocaleDateString()}` : 'No Scadenza'}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {!loading && subTab === 'barcodes' && (
                        <div className="space-y-6">
                             {/* Add Barcode Form */}
                             <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                    <FaBarcode className="text-purple-500" /> Nuovo Codice a Barre
                                </h4>
                                <div className="space-y-3">
                                    <input 
                                        type="text" 
                                        placeholder="Scansiona o scrivi EAN..."
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border rounded-lg text-sm font-mono"
                                        value={newBarcode}
                                        onChange={e => setNewBarcode(e.target.value)}
                                    />
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1">
                                            <p className="text-xs text-gray-500 mb-1">Quantità per Barcode</p>
                                            <input 
                                                type="number" 
                                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border rounded-lg text-sm"
                                                value={newBarcodeQty}
                                                onChange={e => setNewBarcodeQty(parseFloat(e.target.value))}
                                            />
                                        </div>
                                        <button 
                                            onClick={handleAddBarcode}
                                            className="flex-1 mt-auto h-[38px] bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                                        >
                                            Aggiungi
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400">
                                        Esempio: Se questo barcode è di un &quot;Sacco da 5kg&quot;, scrivi 5 nella quantità.
                                    </p>
                                </div>
                            </div>

                            {/* Barcode List */}
                            <div className="space-y-2">
                                {aliases.length === 0 ? (
                                    <p className="text-center text-sm text-gray-400 py-4 italic">Nessun barcode assegnato.</p>
                                ) : (
                                    aliases.map(alias => (
                                        <div key={alias.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                                            <div className="flex items-center gap-3">
                                                <FaBarcode className="text-gray-400 text-lg" />
                                                <div>
                                                    <p className="text-sm font-mono text-gray-900 dark:text-white">
                                                        {alias.barcode}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        Vale: {alias.quantity_in_unit} {item.unit}
                                                    </p>
                                                </div>
                                            </div>
                                            <button 
                                                className="text-gray-400 hover:text-red-500 transition-colors"
                                                onClick={async () => {
                                                    await supabase.from('raw_material_aliases').delete().eq('id', alias.id);
                                                    fetchDetails();
                                                }}
                                            >
                                                <FaTrash />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {subTab === 'scanner' && (
                        <div className="flex flex-col items-center justify-center p-4">
                            <div id="reader" className="w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 shadow-sm"></div>
                            <p className="text-sm text-center text-gray-500 mt-4 max-w-xs mx-auto">
                                Inquadra il codice a barre del prodotto. Se viene riconosciuto, verrà mostrato qui.
                            </p>
                        </div>
                    )}
                
                </div>
            </div>
        </div>
    );
};
