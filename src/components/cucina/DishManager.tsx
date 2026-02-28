/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useCallback } from "react";
import { FaEdit, FaTrash, FaPlus, FaCamera, FaLeaf, FaUtensils, FaToggleOn, FaToggleOff } from "react-icons/fa";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

type DishStatus = 'active' | 'inactive' | 'seasonal' | 'out_of_stock';

type Dish = {
  id: string;
  name: string;
  status: DishStatus;
  image_url?: string;
  description: string;
  station_id?: string;
  ingredients_text?: string;
  allergens_text?: string;
  preparation_method?: string;
};

type Menu = {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  station_id?: string;
  is_active: boolean;
};

export const DishManager: React.FC<{ station: string }> = ({ station }) => {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const [view, setView] = useState<'piatti' | 'menu'>('piatti');
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [allAreas, setAllAreas] = useState<{id: string, name: string}[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");

  const canEdit = areaId ? hasPermission.canEditAreaInventory(areaId) : (station === 'totale' ? (hasPermission.canManageSystem() || user?.global_role === 'head_chef') : false);
  


  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [dishToDelete, setDishToDelete] = useState<Dish | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [menuToDelete, setMenuToDelete] = useState<Menu | null>(null);

  // Filter State
  const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active' as DishStatus,
    image_url: '',
    ingredients_text: '',
    allergens_text: '',
    preparation_method: ''
  });

  const [menuFormData, setMenuFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    is_active: true
  });

  const supabase = createClient();

  // Cloudinary Upload Handler
  const handleFileUpload = async (file: File, type: 'piatti' | 'menu') => {
    if (!file) return;

    try {
        setIsUploading(true);
        setUploadProgress(10);

        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

        if (!cloudName || !uploadPreset) {
            throw new Error("Configuración de Cloudinary no encontrada.");
        }

        const formDataCloud = new FormData();
        formDataCloud.append('file', file);
        formDataCloud.append('upload_preset', uploadPreset);
        formDataCloud.append('folder', `ristorante/${type === 'piatti' ? 'platos' : 'menu'}`);
        // 'auto' is more flexible for unsigned uploads
        formDataCloud.append('resource_type', 'auto');

        setUploadProgress(30);

        // We use the 'auto' endpoint which is more robust
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
            {
                method: 'POST',
                body: formDataCloud
            }
        );

        const data = await response.json();

        if (data.error) throw new Error(data.error.message);

        setUploadProgress(100);
        
        if (type === 'piatti') {
            setFormData(prev => ({ ...prev, image_url: data.secure_url }));
        } else {
            setMenuFormData(prev => ({ ...prev, image_url: data.secure_url }));
        }

        showToast("File caricato con successo!", 'success');
    } catch (err: unknown) {
        console.error("Upload error:", err);
        showToast("Caricamento fallito. Riprova.", 'error');
    } finally {
        setTimeout(() => {
            setIsUploading(false);
            setUploadProgress(0);
        }, 500);
    }
  };

  const resetForm = () => {
    setFormData({
        name: '',
        description: '',
        status: 'active',
        image_url: '',
        ingredients_text: '',
        allergens_text: '',
        preparation_method: ''
    });
    setSelectedAreaId("");
  };

  const handleCreateClick = () => {
    if (view === 'piatti') {
      resetForm();
    } else {
      setMenuFormData({
        title: '',
        description: '',
        image_url: '',
        is_active: true
      });
    }
    setSelectedAreaId("");
    setModalType('create');
    setIsModalOpen(true);
  };

  const handleEditClick = (e: React.MouseEvent, dish: Dish) => {
      e.stopPropagation();
      setSelectedDish(dish);
      setFormData({
          name: dish.name,
          description: dish.description || '',
          status: dish.status,
          image_url: dish.image_url || '',
          ingredients_text: dish.ingredients_text || '',
          allergens_text: dish.allergens_text || '',
          preparation_method: dish.preparation_method || ''
      });
      setSelectedAreaId(dish.station_id || "");
      setModalType('edit');
      setIsModalOpen(true);
  };

  const handleDishClick = (dish: Dish) => {
      setSelectedDish(dish);
      setModalType('view');
      setIsModalOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, dish: Dish) => {
      e.stopPropagation();
      setDishToDelete(dish);
  };

  const confirmDelete = async () => {
      if (!dishToDelete) return;
      
      try {
          const { error } = await supabase.from('dishes').delete().eq('id', dishToDelete.id);
          
          if (error) {
              console.error("Delete error details:", error);
              throw new Error(error.message || "Errore sconosciuto durante l'eliminazione");
          }
          
          setDishes(prev => prev.filter(d => d.id !== dishToDelete.id));
          showToast("Piatto eliminato con successo!", 'success');
      } catch (err: unknown) {
          console.error("Error deleting dish:", err);
          const msg = err instanceof Error ? err.message : 'Impossibile eliminare il piatto';
          showToast(`Errore: ${msg}`, 'error');
      } finally {
          setDishToDelete(null);
      }
  };

  const handleToggleDishStatus = async (e: React.MouseEvent, dish: Dish) => {
    e.stopPropagation();
    // Toggle between seasonal/active and inactive
    const newStatus: DishStatus = dish.status === 'inactive' ? 'seasonal' : 'inactive';
    
    try {
        const { error } = await supabase
            .from('dishes')
            .update({ status: newStatus })
            .eq('id', dish.id);

        if (error) throw error;
        
        // Optimistic update
        setDishes(prev => prev.map(d => d.id === dish.id ? { ...d, status: newStatus } : d));
        showToast(`Stato aggiornato: ${newStatus === 'seasonal' ? 'Attivo' : 'Inattivo'}`, 'success');
    } catch (err: unknown) {
        console.error("Error toggling status:", err);
        showToast("Errore nell'aggiornamento dello stato.", 'error');
    }
  };


  // MENU HANDLERS
  const handleEditMenuClick = (e: React.MouseEvent, menu: Menu) => {
    e.stopPropagation();
    setSelectedMenu(menu);
    setMenuFormData({
      title: menu.title,
      description: menu.description || '',
      image_url: menu.image_url || '',
      is_active: menu.is_active
    });
    setSelectedAreaId(menu.station_id || "");
    setModalType('edit');
    setIsModalOpen(true);
  };

  const handleToggleMenuStatus = async (e: React.MouseEvent, menu: Menu) => {
    e.stopPropagation();
    const newStatus = !menu.is_active;

    try {
      const { error } = await supabase
        .from('menus')
        .update({ is_active: newStatus })
        .eq('id', menu.id);

      if (error) throw error;

      setMenus(prev => prev.map(m => m.id === menu.id ? { ...m, is_active: newStatus } : m));
      showToast(`Menu ${newStatus ? 'attivato' : 'disattivato'}`, 'success');
    } catch(err: unknown) {
      console.error(err);
      showToast("Errore aggiornamento stato menu", 'error');
    }
  };

  const handleDeleteMenuClick = (e: React.MouseEvent, menu: Menu) => {
    e.stopPropagation();
    setMenuToDelete(menu);
  };

  const confirmDeleteMenu = async () => {
    if (!menuToDelete) return;

    try {
      const { error } = await supabase.from('menus').delete().eq('id', menuToDelete.id);
      if (error) throw error;

      setMenus(prev => prev.filter(m => m.id !== menuToDelete.id));
      showToast("Menu eliminato!", 'success');
    } catch(err: unknown) {
      console.error(err);
      showToast("Errore eliminazione menu", 'error');
    } finally {
      setMenuToDelete(null);
    }
  };

  const handleSaveMenu = async () => {
     try {
       if (!menuFormData.title) {
         showToast("Inserisci il titolo del menu", 'error');
         return;
       }

       let targetAreaId = station === 'totale' ? selectedAreaId : areaId;

       if (!targetAreaId && station !== 'totale') {
            const { data } = await supabase.from('areas').select('id').ilike('slug', station).single();
            if (data) targetAreaId = data.id;
       }

       if (!targetAreaId) {
            showToast("Per favore seleziona un'area di destinazione.", 'error');
            return;
       }

       const payload = {
         title: menuFormData.title,
         description: menuFormData.description,
         image_url: menuFormData.image_url,
         is_active: menuFormData.is_active,
         station_id: targetAreaId
       };

       if (modalType === 'create') {
         const { error } = await supabase.from('menus').insert(payload);
         if (error) throw error;
         showToast("Menu creado!", 'success');
       } else {
         if (!selectedMenu) return;
         const { error } = await supabase.from('menus').update(payload).eq('id', selectedMenu.id);
         if (error) throw error;
         showToast("Menu aggiornato!", 'success');
       }
       setIsModalOpen(false);
       fetchMenus();
     } catch (err: unknown) {
       console.error(err);
       showToast("Errore salvataggio menu", 'error');
     }
  };

  const handleSaveDish = async () => {
      try {
          if (!formData.name) {
              showToast("Inserisci il nome del piatto", 'error');
              return;
          }
          
          let targetAreaId = station === 'totale' ? selectedAreaId : areaId;
          
          if (!targetAreaId && station !== 'totale') {
               const { data } = await supabase.from('areas').select('id').ilike('slug', station).single();
               if (data) targetAreaId = data.id;
          }
          
          if (!targetAreaId) {
               showToast("Per favore seleziona un'area di destinazione.", 'error');
               return;
          }

          const payload = {
              name: formData.name,
              description: formData.description,
              status: formData.status,
              image_url: formData.image_url,
              ingredients_text: formData.ingredients_text,
              allergens_text: formData.allergens_text,
              preparation_method: formData.preparation_method,
              station_id: targetAreaId
          };

          if (modalType === 'create') {
              const { error } = await supabase.from('dishes').insert(payload);
              if (error) throw error;
              showToast('Piatto creato con successo!', 'success');
          } else {
              if (!selectedDish) return;
              const { error } = await supabase
                  .from('dishes')
                  .update(payload)
                  .eq('id', selectedDish.id);
              if (error) throw error;
              showToast('Piatto aggiornato!', 'success');
          }

          setIsModalOpen(false);
          fetchDishes();
      } catch (err: unknown) {
          console.error(err);
          const msg = err instanceof Error ? err.message : "Errore sconosciuto";
          showToast("Errore salvataggio: " + msg, 'error');
      }
  };

  const fetchDishes = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
        let currentAreaId: string | null = null;
        let query = supabase.from('dishes').select('*');

        if (station !== 'totale') {
            const { data: areaData, error: areaError } = await supabase
                .from('areas')
                .select('id')
                .ilike('slug', station)
                .single();

            if (areaError || !areaData) {
                console.error("Area not found", areaError);
                 // handle error
            } else {
                currentAreaId = areaData.id;
                setAreaId(currentAreaId);
                query = query.eq('station_id', currentAreaId);
            }
        }

        const { data, error } = await query.order('name');
        
        if (error) throw error;
        
        if (data) {
            setDishes(data as Dish[]);
        }
    } catch (err: unknown) {
        console.error("Error fetching dishes:", err);
        setErrorMsg("Errore nel caricamento dei piatti.");
    } finally {
        setLoading(false);
    }
  }, [station, supabase]);

  // Fetch kitchen-only areas for "Totale" selection
  useEffect(() => {
    const fetchKitchenAreas = async () => {
        // 1. Get Cocina parent
        const { data: kitchenParent } = await supabase
            .from('areas')
            .select('id')
            .eq('slug', 'cocina')
            .single();

        if (kitchenParent) {
            // 2. Fetch children
            const { data } = await supabase
                .from('areas')
                .select('id, name')
                .eq('parent_id', kitchenParent.id)
                .order('name');
            if (data) setAllAreas(data);
        } else {
            // Fallback: exclude known service areas
            const { data } = await supabase
                .from('areas')
                .select('id, name')
                .not('slug', 'in', '("sala","locale","bar","cocina")')
                .order('name');
            if (data) setAllAreas(data);
        }
    };
    if (station === 'totale') {
        fetchKitchenAreas();
    }
  }, [station, supabase]);

  const fetchMenus = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('menus').select('*');
      
      // If we are in a specific station, filter by station (assuming menus are station-linked, otherwise show all?)
      // The user wants "Gestione Menu" in the kitchen. 
      // If station is 'totale', show all. Else filter.
      if (station !== 'totale') {
           const { data: areaData } = await supabase.from('areas').select('id').ilike('slug', station).single();
           if (areaData) {
               query = query.eq('station_id', areaData.id);
           }
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setMenus(data as Menu[]);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [station, supabase]);

  useEffect(() => {
    if (view === 'piatti') {
        fetchDishes();
    } else {
        fetchMenus();
    }
  }, [fetchDishes, fetchMenus, view]);


  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col h-full">
      
      {/* Header */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Gestione: {station}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Organizza i piatti e crea i menu.</p>
        </div>
        
        <div className="flex gap-2">
            <button 
                onClick={() => setView('piatti')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${view === 'piatti' ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'}`}
            >
                Piatti
            </button>
            <button 
                onClick={() => setView('menu')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${view === 'menu' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'}`}
            >
                Menu
            </button>
        </div>

        {canEdit && (
            <button 
                onClick={handleCreateClick}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm ml-auto sm:ml-0"
            >
                <FaPlus />
                {view === 'piatti' ? 'Nuovo Piatto' : 'Nuovo Menu'}
            </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        
        {/* Filters & Search Toolbar */}
        {view === 'piatti' && (
            <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-between items-center">
                <div className="relative flex-1 w-full max-w-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Cerca piatto..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 text-sm placeholder-gray-500 focus:border-brand-500 focus:ring-brand-500 dark:text-white outline-none transition-shadow"
                    />
                </div>
                
                {/* Dish Count Badge */}
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {dishes.filter(d => {
                         if (filterStatus === 'active' && d.status === 'inactive') return false;
                         if (filterStatus === 'inactive' && d.status !== 'inactive') return false;
                         if (searchQuery) {
                            const q = searchQuery.toLowerCase();
                            return d.name.toLowerCase().includes(q) || (d.description && d.description.toLowerCase().includes(q));
                         }
                         return true;
                    }).length} Piatti
                </div>

                <div className="w-full sm:w-auto">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as 'active' | 'inactive' | 'all')}
                        className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 pl-3 pr-8 text-sm focus:border-brand-500 focus:ring-brand-500 dark:text-white outline-none cursor-pointer"
                    >
                        <option value="active">Attivi</option>
                        <option value="inactive">Inattivi</option>
                        <option value="all">Tutti</option>
                    </select>
                </div>
            </div>
        )}

        {loading ? (
             <div className="flex justify-center py-10">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
             </div>
        ) : errorMsg ? (
             <div className="text-red-500 text-center py-10">{errorMsg}</div>
        ) : view === 'piatti' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {dishes
                    .filter(dish => {
                        // Filter by Status
                        if (filterStatus === 'active' && dish.status === 'inactive') return false;
                        if (filterStatus === 'inactive' && dish.status !== 'inactive') return false;
                        
                        // Filter by Search
                        if (searchQuery) {
                            const query = searchQuery.toLowerCase();
                            return (
                                dish.name.toLowerCase().includes(query) || 
                                (dish.description && dish.description.toLowerCase().includes(query))
                            );
                        }
                        return true;
                    })
                    .map((dish) => (
                    <div 
                        key={dish.id} 
                        onClick={() => handleDishClick(dish)}
                        className="group relative flex flex-col bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-md transition-all cursor-pointer"
                    >
                        
                        {/* Image Area - Updated Style */}
                        <div className="h-48 w-full bg-gray-100 dark:bg-gray-800 rounded-t-xl overflow-hidden relative">
                            {dish.image_url ? (
                                <>
                                    {/* Blurred Background */}
                                    <div 
                                        className="absolute inset-0 bg-cover bg-center blur-md scale-110 opacity-60"
                                        style={{ backgroundImage: `url(${dish.image_url})` }}
                                    />
                                    {/* Main Image (Contain) */}
                                    <img 
                                        src={dish.image_url} 
                                        alt={dish.name} 
                                        className="relative w-full h-full object-contain z-10 transition-transform duration-500 group-hover:scale-105" 
                                    />
                                </>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800">
                                    <FaCamera className="h-8 w-8 opacity-50" />
                                </div>
                            )}
                            
                        </div>

                        {/* Content */}
                        <div className="p-4 flex flex-col flex-1">
                            <h4 className="font-bold text-gray-900 dark:text-white text-lg mb-1">{dish.name}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 mb-4">{dish.description}</p>
                            
                            <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-600">
                                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                                    {station}
                                </span>
                                         <div className="flex gap-2">
                                    {canEdit && (
                                        <>
                                            {/* Quick Toggle Status */}
                                            <button 
                                                onClick={(e) => handleToggleDishStatus(e, dish)}
                                                className={`p-2 rounded-lg transition-colors border ${dish.status === 'inactive' ? 'text-gray-400 border-gray-100 hover:text-green-600 hover:bg-green-50' : 'text-green-600 border-green-100 hover:text-gray-500 hover:bg-gray-100'}`}
                                                title={dish.status === 'inactive' ? "Attiva Piatto" : "Disattiva Piatto"}
                                            >
                                                {dish.status === 'inactive' ? <FaToggleOff className="w-4 h-4" /> : <FaToggleOn className="w-4 h-4" />}
                                            </button>

                                            <button 
                                                onClick={(e) => handleEditClick(e, dish)}
                                                className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 border border-gray-100 rounded-lg transition-colors" 
                                                title="Modifica Piatto"
                                            >
                                                <FaEdit className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={(e) => handleDeleteClick(e, dish)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-100 rounded-lg transition-colors" 
                                                title="Archivia"
                                            >
                                                <FaTrash className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

            </div>
        ) : (
            <div className="flex flex-col">
                {/* Menu Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-between items-center">
                    <div className="relative flex-1 w-full max-w-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Cerca menu..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 text-sm placeholder-gray-500 focus:border-brand-500 focus:ring-brand-500 dark:text-white outline-none transition-shadow"
                        />
                    </div>

                    {/* Menu Count Badge */}
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {menus.filter(m => {
                             if (filterStatus === 'active' && !m.is_active) return false;
                             if (filterStatus === 'inactive' && m.is_active) return false;
                             if (searchQuery) {
                                const q = searchQuery.toLowerCase();
                                return m.title.toLowerCase().includes(q) || (m.description && m.description.toLowerCase().includes(q));
                             }
                             return true;
                        }).length} Menu
                    </div>
                    
                    <div className="w-full sm:w-auto">
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as 'active' | 'inactive' | 'all')}
                            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 pl-3 pr-8 text-sm focus:border-brand-500 focus:ring-brand-500 dark:text-white outline-none cursor-pointer"
                        >
                            <option value="active">Attivi</option>
                            <option value="inactive">Inattivi</option>
                            <option value="all">Tutti</option>
                        </select>
                    </div>
                </div>

                {/* Menu Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {menus.filter(menu => {
                        if (filterStatus === 'active' && !menu.is_active) return false;
                        if (filterStatus === 'inactive' && menu.is_active) return false;
                        if (searchQuery) {
                            return menu.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                   (menu.description?.toLowerCase().includes(searchQuery.toLowerCase()));
                        }
                        return true;
                    }).map(menu => {
                         const isPdf = menu.image_url?.toLowerCase().endsWith('.pdf') || 
                                       menu.image_url?.toLowerCase().endsWith('.doc') || 
                                       menu.image_url?.toLowerCase().endsWith('.docx');
                         
                         return (
                            <div key={menu.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
                                <div className="h-40 bg-gray-100 dark:bg-gray-700 flex items-center justify-center relative group">
                                    {menu.image_url ? (
                                        isPdf ? (
                                            <a href={menu.image_url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 text-gray-500 hover:text-brand-600 transition-colors">
                                                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                <span className="text-sm font-medium">Visualizza Documento</span>
                                            </a>
                                        ) : (
                                            <img src={menu.image_url} alt={menu.title} className="w-full h-full object-cover" />
                                        )
                                    ) : (
                                        <div className="text-gray-400 flex flex-col items-center">
                                            <FaUtensils className="w-8 h-8 opacity-30 mb-2" />
                                            <span className="text-xs">Nessuna immagine</span>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-gray-900 dark:text-white line-clamp-1" title={menu.title}>{menu.title}</h4>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 h-10">{menu.description || "Nessuna descrizione."}</p>
                                    
                                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${menu.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                                            {menu.is_active ? 'Attivo' : 'Inattivo'}
                                        </span>
                                        
                                         <div className="flex gap-2">
                                             {canEdit && (
                                                 <>
                                                     <button 
                                                         onClick={(e) => handleToggleMenuStatus(e, menu)}
                                                         className={`p-2 rounded-lg transition-colors border ${!menu.is_active ? 'text-gray-400 border-gray-100 hover:text-green-600 hover:bg-green-50' : 'text-green-600 border-green-100 hover:text-gray-500 hover:bg-gray-100'}`}
                                                         title={!menu.is_active ? "Attiva Menu" : "Disattiva Menu"}
                                                     >
                                                         {!menu.is_active ? <FaToggleOff className="w-4 h-4" /> : <FaToggleOn className="w-4 h-4" />}
                                                     </button>

                                                     <button 
                                                         onClick={(e) => handleEditMenuClick(e, menu)}
                                                         className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 border border-gray-100 rounded-lg transition-colors"
                                                         title="Modifica"
                                                     >
                                                         <FaEdit className="w-4 h-4" />
                                                     </button>
                                                     
                                                     <button 
                                                         onClick={(e) => handleDeleteMenuClick(e, menu)}
                                                         className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-100 rounded-lg transition-colors"
                                                         title="Elimina"
                                                     >
                                                         <FaTrash className="w-4 h-4" />
                                                     </button>
                                                 </>
                                             )}
                                         </div>
                                    </div>
                                </div>
                            </div>
                         );
                    })}
                    {menus.length === 0 && (
                        <div className="col-span-full py-10 text-center text-gray-500">
                            Nessun menu trovato. Crea il primo!
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
      
      {/* Modal */}
      {isModalOpen && (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsModalOpen(false)}
        >
                <div 
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full ${modalType === 'view' ? 'max-w-2xl' : 'max-w-md sm:max-w-2xl'} overflow-hidden flex flex-col max-h-[90vh] relative`}
                onClick={(e) => e.stopPropagation()}
            >
                
                {/* Header - HIDDEN IN VIEW MODE */}
                {modalType !== 'view' && (
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                            {view === 'piatti' 
                                ? (modalType === 'create' ? 'Crea Nuovo Piatto' : 'Modifica Piatto') 
                                : (modalType === 'create' ? 'Crea Nuovo Menu' : 'Modifica Menu')
                            }
                        </h3>
                        <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                            ✕
                        </button>
                    </div>
                )}

                {/* Close Button for View Mode (Absolute) */}
                {modalType === 'view' && (
                    <button 
                        onClick={() => setIsModalOpen(false)} 
                        className="absolute top-4 right-4 z-50 bg-white/90 hover:bg-white text-gray-800 rounded-full p-2 shadow-lg backdrop-blur-sm transition-all border border-gray-200/50"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}

                {/* Body - VIEW MODE */}
                {modalType === 'view' && selectedDish ? (
                    <div className="flex-1 overflow-y-auto p-0 bg-white dark:bg-gray-900 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                        {/* Hero Image */}
                        {selectedDish.image_url ? (
                             <div className="w-full h-64 sm:h-96 relative group overflow-hidden bg-gray-100 dark:bg-gray-800">
                                 {/* Blurred Background */}
                                 <div 
                                    className="absolute inset-0 bg-cover bg-center blur-xl opacity-60 scale-110"
                                    style={{ backgroundImage: `url(${selectedDish.image_url})` }}
                                 />
                                 
                                 {/* Main Image (Contain) */}
                                 <img 
                                    src={selectedDish.image_url} 
                                    alt={selectedDish.name} 
                                    className="relative w-full h-full object-contain z-10" 
                                 />

                                 <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/30 to-transparent flex items-end z-20">
                                     <div className="p-4 sm:p-8 w-full">
                                         <h2 className="text-xl sm:text-3xl font-bold text-white shadow-sm mb-1 sm:mb-2">{selectedDish.name}</h2>
                                         {selectedDish.description && (
                                             <p className="text-white/90 text-xs sm:text-base leading-relaxed font-medium line-clamp-2 sm:line-clamp-3 max-w-2xl">{selectedDish.description}</p>
                                         )}
                                     </div>
                                 </div>
                             </div>
                        ) : (
                            <div className="p-6 pb-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{selectedDish.name}</h2>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">{selectedDish.description}</p>
                            </div>
                        )}

                        <div className="p-6 flex flex-col gap-6">
                             
                             {/* Ingredients */}
                             <div className="space-y-3">
                                 <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                     <FaLeaf className="text-brand-500" />
                                     Ingredienti
                                 </h4>
                                 {selectedDish.ingredients_text ? (
                                    <div className="bg-gray-50/50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
                                        <ul className="space-y-2">
                                            {selectedDish.ingredients_text.split('\n').filter(line => line.trim() !== '').map((line, idx) => (
                                                <li key={idx} className="flex items-start gap-2 text-gray-700 dark:text-gray-300 text-sm border-b border-gray-100 dark:border-gray-700 last:border-0 pb-1.5 last:pb-0">
                                                    <span className="h-1 w-1 rounded-full bg-brand-400 mt-2 shrink-0"></span>
                                                    {line}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                 ) : (
                                     <p className="text-gray-400 italic text-sm">Nessun ingrediente specificato.</p>
                                 )}
                             </div>

                             {/* Preparation */}
                             <div className="space-y-3">
                                 <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                     <FaUtensils className="text-brand-500" />
                                     Preparazione
                                 </h4>
                                 {selectedDish.preparation_method ? (
                                     <div className="text-gray-600 dark:text-gray-300 leading-6 whitespace-pre-line text-sm">
                                         {selectedDish.preparation_method}
                                     </div>
                                 ) : (
                                     <p className="text-gray-400 italic text-sm">Nessun metodo di preparazione specificato.</p>
                                 )}
                             </div>

                             {/* Allergens */}
                             {selectedDish.allergens_text && (
                                 <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                                     <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30">
                                         <div className="text-red-500 text-lg">⚠️</div>
                                         <div>
                                             <span className="text-xs font-bold text-red-800 dark:text-red-400 uppercase tracking-wider mr-2">Allergeni:</span>
                                             <span className="text-red-700 dark:text-red-300 font-medium text-sm">
                                                 {selectedDish.allergens_text}
                                             </span>
                                         </div>
                                     </div>
                                 </div>
                             )}

                        </div>

                    </div>
                ) : view === 'piatti' ? (
                    /* Body - CREATE/EDIT DISH FORM */
                    <div className="p-6 overflow-y-auto space-y-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                    
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome Piatto *</label>
                             <input 
                                type="text" 
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                placeholder="Es. Spaghetti Carbonara"
                             />
                        </div>
                        
                        <div className="sm:col-span-2">
                             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrizione</label>
                             <textarea 
                                value={formData.description}
                                onChange={e => setFormData({...formData, description: e.target.value})}
                                rows={3}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                                placeholder="Descrivi il piatto, allergeni, etc."
                             />
                        </div>

                        <div>
                             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stato</label>
                             <select
                                 value={formData.status === 'active' ? 'seasonal' : formData.status} // Normalize active to seasonal for the UI
                                 onChange={e => setFormData({...formData, status: e.target.value as DishStatus})}
                                 className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                             >
                                  <option value="seasonal">Stagionale (Attivo)</option>
                                  <option value="inactive">Inattivo</option>
                             </select>
                        </div>
                        
                        <div>
                             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Immagine Piatto</label>
                             <div className="flex flex-col gap-3">
                                 {formData.image_url ? (
                                     <div className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 h-32 bg-gray-50 dark:bg-gray-900">
                                         <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                                         <button 
                                            onClick={() => setFormData({...formData, image_url: ''})}
                                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Rimuovi immagine"
                                         >
                                             ✕
                                         </button>
                                     </div>
                                 ) : (
                                     <label className={`flex flex-col items-center justify-center h-32 w-full border-2 border-dashed rounded-lg transition-colors cursor-pointer ${isUploading ? 'bg-gray-50 border-gray-200' : 'border-gray-300 dark:border-gray-600 hover:border-brand-500 dark:hover:border-brand-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                                         {isUploading ? (
                                             <div className="flex flex-col items-center gap-2">
                                                 <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                                                 <span className="text-xs font-medium text-gray-500">{uploadProgress}% Caricamento...</span>
                                             </div>
                                         ) : (
                                             <div className="flex flex-col items-center">
                                                 <FaCamera className="h-6 w-6 text-gray-400 mb-2" />
                                                 <span className="text-xs text-gray-500 font-medium">Clicca per caricare</span>
                                                 <span className="text-[10px] text-gray-400">JPG, PNG o WEBP</span>
                                             </div>
                                         )}
                                         <input 
                                            type="file" 
                                            className="hidden" 
                                            accept="image/*"
                                            disabled={isUploading}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleFileUpload(file, 'piatti');
                                            }}
                                         />
                                     </label>
                                 )}
                             </div>
                        </div>
                    </div>

                    {station === 'totale' && (
                        <div className="sm:col-span-2 pt-2">
                             <label className="text-sm font-semibold text-brand-600 dark:text-brand-400 mb-2 flex items-center gap-2">
                                <FaUtensils className="text-xs" />
                                Area di Destinazione *
                             </label>
                             <select
                                value={selectedAreaId}
                                onChange={e => setSelectedAreaId(e.target.value)}
                                className="w-full px-3 py-2 bg-brand-50/50 dark:bg-brand-900/10 border border-brand-200 dark:border-brand-800 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                             >
                                 <option value="">Seleziona Area...</option>
                                 {allAreas.map(area => (
                                      <option key={area.id} value={area.id}>{area.name}</option>
                                 ))}
                             </select>
                             <p className="text-[10px] text-gray-400 mt-1 italic">Indica a quale stazione appartiene questo piatto.</p>
                        </div>
                    )}

                    {/* Ingredients & Recipe Manual Entry */}
                    <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <h4 className="font-bold text-gray-900 dark:text-white">Dettagli Ricetta & Ingredienti</h4>
                        
                        <div>
                             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lista Ingredienti (Manuale)</label>
                             <textarea 
                                value={formData.ingredients_text}
                                onChange={e => setFormData({...formData, ingredients_text: e.target.value})}
                                rows={4}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none resize-y font-mono text-sm"
                                placeholder={"200g Pasta\n2 Uova\nPepe Nero..."}
                             />
                             <p className="text-xs text-gray-500 mt-1">Inserisci gli ingredienti uno per riga.</p>
                        </div>

                        <div>
                             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Metodo di Preparazione</label>
                             <textarea 
                                value={formData.preparation_method}
                                onChange={e => setFormData({...formData, preparation_method: e.target.value})}
                                rows={4}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none resize-y"
                                placeholder="Descrivi i passaggi per la preparación..."
                             />
                        </div>

                        <div>
                             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Allergeni</label>
                             <input 
                                type="text" 
                                value={formData.allergens_text}
                                onChange={e => setFormData({...formData, allergens_text: e.target.value})}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                placeholder="Es. Glutine, Uova, Lattosio..."
                             />
                        </div>
                    </div>

                </div>

                ) : (
                    /* Body - CREATE/EDIT MENU FORM */
                    <div className="p-6 overflow-y-auto space-y-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                         <div className="grid grid-cols-1 gap-4">
                             <div>
                                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Titolo Menu *</label>
                                 <input 
                                    type="text" 
                                    value={menuFormData.title}
                                    onChange={e => setMenuFormData({...menuFormData, title: e.target.value})}
                                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    placeholder="Es. Menu Degustazione Inverno"
                                 />
                             </div>

                             <div>
                                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrizione</label>
                                 <textarea 
                                    value={menuFormData.description}
                                    onChange={e => setMenuFormData({...menuFormData, description: e.target.value})}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                                    placeholder="Descrivi il menu..."
                                 />
                             </div>

                             <div>
                                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Carica Menu (Immagine o PDF)</label>
                                 <div className="flex flex-col gap-3">
                                     {menuFormData.image_url ? (
                                         <div className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
                                             <div className="flex items-center gap-3 overflow-hidden">
                                                 <div className="bg-brand-100 p-2 rounded-lg text-brand-600">
                                                     {menuFormData.image_url.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}
                                                 </div>
                                                 <span className="text-xs font-medium text-gray-600 truncate">{menuFormData.image_url.split('/').pop()}</span>
                                             </div>
                                             <button 
                                                onClick={() => setMenuFormData({...menuFormData, image_url: ''})}
                                                className="p-1 px-2.5 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600"
                                             >
                                                 Rimuovi
                                             </button>
                                         </div>
                                     ) : (
                                         <label className={`flex flex-col items-center justify-center h-24 w-full border-2 border-dashed rounded-lg transition-colors cursor-pointer ${isUploading ? 'bg-gray-50 border-gray-200' : 'border-gray-300 dark:border-gray-600 hover:border-brand-500 dark:hover:border-brand-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                                             {isUploading ? (
                                                 <div className="flex items-center gap-3">
                                                     <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                                                     <span className="text-xs font-medium text-gray-500">{uploadProgress}% In corso...</span>
                                                 </div>
                                             ) : (
                                                 <div className="flex flex-col items-center">
                                                     <FaPlus className="h-5 w-5 text-gray-400 mb-1" />
                                                     <span className="text-xs text-gray-500 font-medium">Carica file</span>
                                                     <span className="text-[10px] text-gray-400">PDF, JPG o PNG</span>
                                                 </div>
                                             )}
                                             <input 
                                                type="file" 
                                                className="hidden" 
                                                accept="image/*,application/pdf"
                                                disabled={isUploading}
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleFileUpload(file, 'menu');
                                                }}
                                             />
                                         </label>
                                     )}
                                 </div>
                             </div>

                             <div>
                                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Stato</label>
                                 <div className="flex gap-4">
                                     <label className="flex items-center gap-2 cursor-pointer">
                                         <input 
                                            type="radio" 
                                            checked={menuFormData.is_active} 
                                            onChange={() => setMenuFormData({...menuFormData, is_active: true})}
                                            className="text-brand-600 focus:ring-brand-500"
                                         />
                                         <span className="text-gray-700 dark:text-gray-300 text-sm">Attivo</span>
                                     </label>
                                     <label className="flex items-center gap-2 cursor-pointer">
                                         <input 
                                            type="radio" 
                                            checked={!menuFormData.is_active} 
                                            onChange={() => setMenuFormData({...menuFormData, is_active: false})}
                                            className="text-brand-600 focus:ring-brand-500"
                                         />
                                         <span className="text-gray-700 dark:text-gray-300 text-sm">Inattivo</span>
                                     </label>
                                 </div>
                             </div>

                             {station === 'totale' && (
                                <div className="pt-2">
                                    <label className="text-sm font-semibold text-brand-600 dark:text-brand-400 mb-2 flex items-center gap-2">
                                        <FaUtensils className="text-xs" />
                                        Area di Destinazione *
                                    </label>
                                    <select
                                        value={selectedAreaId}
                                        onChange={e => setSelectedAreaId(e.target.value)}
                                        className="w-full px-3 py-2 bg-brand-50/50 dark:bg-brand-900/10 border border-brand-200 dark:border-brand-800 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                                    >
                                        <option value="">Seleziona Area...</option>
                                        {allAreas.map(area => (
                                            <option key={area.id} value={area.id}>{area.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-gray-400 mt-1 italic">Indica a quale stazione appartiene questo menu.</p>
                                </div>
                             )}
                         </div>
                    </div>
                )}

                {/* Footer - Only for Create/Edit */}
                {modalType !== 'view' && (
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-end gap-3 bg-gray-50/50 dark:bg-gray-900/50">
                    <button 
                        onClick={() => setIsModalOpen(false)}
                        className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 rounded-lg transition-all"
                    >
                        Annulla
                    </button>
                    <button 
                        onClick={view === 'piatti' ? handleSaveDish : handleSaveMenu}
                        className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-all"
                    >
                        {modalType === 'create' ? (view === 'piatti' ? 'Crea Piatto' : 'Crea Menu') : 'Salva Modifiche'}
                    </button>
                </div>
                )}
            </div>
        </div>
      )}

      {/* Custom Confirmation Modal (Dish) */}
      {dishToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setDishToDelete(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Conferma Eliminazione Piatto</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                    Sei sicuro di voler eliminare definitivo il piatto <strong>&quot;{dishToDelete.name}&quot;</strong>? Questa azione non può essere annullata.
                </p>
                <div className="flex justify-end gap-3">
                    <button 
                        onClick={() => setDishToDelete(null)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        Annulla
                    </button>
                    <button 
                        onClick={confirmDelete}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
                    >
                        Elimina
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Custom Confirmation Modal (Menu) */}
      {menuToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setMenuToDelete(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Conferma Eliminazione Menu</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                    Sei sicuro di voler eliminare il menu <strong>&quot;{menuToDelete.title}&quot;</strong>?
                </p>
                <div className="flex justify-end gap-3">
                    <button 
                        onClick={() => setMenuToDelete(null)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        Annulla
                    </button>
                    <button 
                        onClick={confirmDeleteMenu}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
                    >
                        Elimina
                    </button>
                </div>
            </div>
        </div>
      )}



    </div>
  );
};
