"use client";
import React, { useState, useEffect, useCallback } from "react";
import { FaUserPlus, FaEdit, FaSearch, FaEye, FaEyeSlash } from "react-icons/fa";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import { createStaffUserAction, deleteStaffUserAction, updateStaffUserAction } from "@/app/actions/create-staff";
import { useAuth } from "@/context/AuthContext";

// import { fixAreasHierarchyAction } from "@/app/actions/fix-database"; // Commented out unused

// Define the roles based on your ENUM
type UserRole = 'super_admin' | 'admin' | 'head_chef' | 'maitre' | 'staff' | 'cameriere' | 'cuoco';

interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  global_role: UserRole;
  is_active: boolean;
  avatar_url?: string | null;
  assigned_area_id?: string | null;
  role_in_area?: string | null;
  assigned_area_ids?: string[]; // Added for multi-select
}

export const StaffManager: React.FC = () => {
    const { hasPermission } = useAuth();
    const canManageSystem = hasPermission.canManageSystem();
    const supabase = createClient();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');

    // Create / Edit Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('edit');
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
    
    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [profileToDelete, setProfileToDelete] = useState<Profile | null>(null);

    // Permissions Modal State


    // Success Modal State (removed as requested)
    
    // Error State
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Password Visibility State
    const [showPassword, setShowPassword] = useState(false);

    const [allAreas, setAllAreas] = useState<{id: string, name: string, parent_id: string | null}[]>([]);
    const [selectedParentArea, setSelectedParentArea] = useState<string>("");

    const [formData, setFormData] = useState<{
        email: string;
        password?: string; // Only for creation
        first_name: string;
        last_name: string;
        global_role: UserRole;
        is_active: boolean;
        assigned_area_ids: string[];
        is_area_manager?: boolean;
    }>({
        email: "",
        password: "",
        first_name: "",
        last_name: "",
        global_role: "" as any,
        is_active: true,
        assigned_area_ids: [],
        is_area_manager: false
    });

    const fetchProfiles = useCallback(async () => {
        setLoading(true);
        try {
            // Load All Areas
            const { data: areasData } = await supabase
                .from('areas')
                .select('id, name, parent_id')
                .order('name');
            
            const fetchedAreas = areasData || [];
            setAllAreas(fetchedAreas);

            // Load Profiles
            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('*')
                .order('first_name', { ascending: true });
            
            if (profilesError) throw profilesError;

            // Load Assignments
            const { data: assignmentsData, error: assignmentsError } = await supabase
                .from('area_assignments')
                .select('user_id, area_id, role_in_area');

            if (assignmentsError) console.error("Error fetching assignments:", assignmentsError);

            // Merge Data
            const mergedProfiles = (profilesData as any[]).map(profile => {
                // Multi-select logic
                // Find all assignments for this user
                const userAssignments = assignmentsData?.filter(a => a.user_id === profile.id) || [];
                const assignedIds = userAssignments.map(a => a.area_id);
                // Determines if 'editor' in ANY area (could be refined)
                const isManager = userAssignments.some(a => a.role_in_area === 'manager' || a.role_in_area === 'editor');
                const primaryAreaId = assignedIds[0] || null;

                return {
                    ...profile,
                    assigned_area_id: primaryAreaId, 
                    assigned_area_ids: assignedIds, 
                    role_in_area: isManager ? 'manager' : 'viewer'
                };
            });

            setProfiles(mergedProfiles as Profile[]);
        } catch (error) {
            console.error("Error fetching profiles:", error);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchProfiles();
    }, [fetchProfiles]);

    const handleEditClick = (profile: Profile) => {
        setSelectedProfile(profile);
        setModalMode('edit');

        // Determine Parent Area for UI Pre-selection
        let parentId = "";
        
        // Priority 1: Check existing assignments
        const firstAssignmentId = profile.assigned_area_ids?.[0] || profile.assigned_area_id;

        if (firstAssignmentId) {
             const area = allAreas.find(a => a.id === firstAssignmentId);
             if (area) {
                 // If it has a parent, set Parent to that. If not, it is a parent.
                 parentId = area.parent_id || area.id;
             }
        }

        // Priority 2: Fallback to Role Defaults if no assignment found (or if assignment is invalid)
        if (!parentId) {
            if (['head_chef', 'cuoco'].includes(profile.global_role)) {
                const cocina = allAreas.find(a => (a.name.toLowerCase() === 'cocina' || a.name.toLowerCase() === 'kitchen') && !a.parent_id);
                if (cocina) parentId = cocina.id;
            } else if (['maitre', 'cameriere'].includes(profile.global_role)) {
                const sala = allAreas.find(a => (a.name.toLowerCase() === 'sala' || a.name.toLowerCase() === 'dining room') && !a.parent_id);
                if (sala) parentId = sala.id;
            }
        }

        setSelectedParentArea(parentId);

        setFormData({
            email: profile.email,
            first_name: profile.first_name || "",
            last_name: profile.last_name || "",
            global_role: profile.global_role,
            is_active: profile.is_active,
            password: "", // Reset password field specifically for edit mode (security hygiene)
            // Load assignments for this profile
            assigned_area_ids: profile.assigned_area_ids || (profile.assigned_area_id ? [profile.assigned_area_id] : []),
            is_area_manager: profile.role_in_area === 'manager' || profile.role_in_area === 'editor'
        });
        setErrorMsg(null);
        setIsModalOpen(true);
    };

    const handleCreateClick = () => {
        setSelectedProfile(null);
        setModalMode('create');
        setSelectedParentArea(""); // Reset cascading dropdown
        setFormData({
            email: "",
            password: "",
            first_name: "",
            last_name: "",
            global_role: "" as any, // Force user to select
            is_active: true,
            assigned_area_ids: [],
            is_area_manager: false
        });
        setErrorMsg(null);
        setIsModalOpen(true);
    };

    const handleDeleteClick = (profile: Profile) => {
        setProfileToDelete(profile);
        setErrorMsg(null);
        setIsDeleteModalOpen(true);
    }



    const handleSave = async () => {
        setErrorMsg(null);
        try {
            if (!formData.email || !formData.first_name || !formData.last_name || !formData.global_role) {
                setErrorMsg("Compila tutti i campi obbligatori.");
                return;
            }

            // Area validation
            const isOperationalRole = ['head_chef', 'maitre', 'cuoco', 'cameriere', 'staff'].includes(formData.global_role);
            if (isOperationalRole && (!formData.assigned_area_ids || formData.assigned_area_ids.length === 0)) {
                setErrorMsg("Per questo ruolo è necessario assegnare almeno un'area di lavoro.");
                return;
            }

            if (modalMode === 'edit' && selectedProfile) {
                // UPDATE USER (via SERVER ACTION)
                const result = await updateStaffUserAction({
                     id: selectedProfile.id,
                     email: formData.email,
                     first_name: formData.first_name,
                     last_name: formData.last_name,
                     global_role: formData.global_role,
                     is_active: formData.is_active,
                     password: formData.password, // Optional
                     assigned_area_ids: formData.assigned_area_ids,
                     is_area_manager: formData.is_area_manager
                });

                if (!result.success) {
                    throw new Error(result.error || "Errore sconosciuto durante l'aggiornamento");
                }

                console.log('Update success, refreshing profiles...', formData);
                fetchProfiles(); // Ensure we see server state

                setProfiles(prev => prev.map(p => p.id === selectedProfile.id ? { 
                    ...p, 
                    ...formData,
                    // Manually sync role_in_area for UI consistency without full refetch
                    role_in_area: formData.is_area_manager ? 'manager' : 'viewer'
                } : p));
                setErrorMsg(null);
            } else {
                // CREATE NEW USER (via SERVER ACTION -> ADMIN API)
                // Bypasses rate limits and email confirmation
                
                const result = await createStaffUserAction({
                    email: formData.email.trim(),
                    password: formData.password || "temp12345",
                    first_name: formData.first_name.trim(),
                    last_name: formData.last_name.trim(),
                    global_role: formData.global_role as any,
                    is_active: formData.is_active,
                    assigned_area_ids: formData.assigned_area_ids,
                    is_area_manager: formData.is_area_manager
                });

                if (!result.success) {
                    throw new Error(result.error || "Errore sconosciuto durante la creazione");
                }
                
                // If success, refresh the list
                fetchProfiles(); 
            }
            setIsModalOpen(false);
        } catch (error: unknown) {
            const err = error as Error;
            console.error("Error saving profile:", err);
            setErrorMsg(err.message || "Impossibile salvare");
        }
    };

    const confirmDelete = async () => {
        if (!profileToDelete) return;
        try {
            // Note: Deleting from 'profiles' only works if we have Cascade Delete on Foreign Keys
            // AND if we have permission. Usually we need to delete from AUTH. 
            // Client-side 'supabase.auth.admin' is NOT available. 
            // accessible only via Service Role. 
            // So for now, we will mark as INACTIVE or try DELETE on 'profiles' if RLS allows.
            
            // Try Soft Delete (Deactivate) first as it is safer
            // Or if user insists on "Delete", we try DB delete.
            // Perform Server Action Delete (Admin Level)
            const result = await deleteStaffUserAction(profileToDelete.id);

            if (!result.success) {
                throw new Error(result.error || "Errore sconosciuto durante l'eliminazione");
            }

            // Success
            setProfiles(prev => prev.filter(p => p.id !== profileToDelete.id));
            setIsDeleteModalOpen(false);
            setProfileToDelete(null);
            setErrorMsg(null);
            
            // Refresh full list just in case
            fetchProfiles();

        } catch (err: unknown) {
             const error = err as Error;
             console.error("Delete error:", error);
             setErrorMsg("Errore eliminazione: " + error.message);
        }
    }

    const getRoleBadgeColor = (role: UserRole) => {
        switch (role) {
            case 'super_admin': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
            case 'admin': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
            case 'head_chef': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
            case 'maitre': return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300';
            case 'cuoco': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
            case 'cameriere': return 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300';
        }
    };

    const getRoleLabel = (role: UserRole) => {
        switch (role) {
            case 'super_admin': return 'Tecnologia';
            case 'admin': return 'Amministratore';
            case 'head_chef': return 'Chef';
            case 'maitre': return 'Capo Sala';
            case 'maitre': return 'Capo Sala';
            case 'staff': return 'Staff (Generico)';
            case 'cuoco': return 'Cuoco';
            case 'cameriere': return 'Cameriere';
            default: return role;
        }
    };

    // Filter Logic
    // Helper to get role-based avatar
    const getRoleAvatar = (role: UserRole) => {
        switch (role) {
            case 'super_admin':
            case 'admin':
                return "/placeholder-administrador.png";
            case 'head_chef':
            case 'cuoco':
                return "/placeholder-cocina.png";
            case 'maitre':
            case 'cameriere':
                return "/placeholder-sala.png";
            default:
                return "/placeholder-ti.png";
        }
    };

    // Filter Logic
    const filteredProfiles = profiles.filter(profile => {
        const matchesSearch = 
            (profile.email?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
            (profile.first_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
            (profile.last_name?.toLowerCase() || "").includes(searchQuery.toLowerCase());
        
        const matchesRole = roleFilter === 'all' || profile.global_role === roleFilter;

        return matchesSearch && matchesRole;
    });

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col h-full">
            
            {/* Toolbar */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Cerca per nome o email..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border-gray-200 rounded-lg focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 outline-none"
                    />
                </div>
                
                <div className="flex gap-2">
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                        className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 focus:border-brand-500 outline-none"
                    >
                        <option value="all">Tutti i Ruoli</option>
                        <option value="head_chef">Chef</option>
                        <option value="maitre">Capo Sala</option>
                        <option value="cuoco">Cuoco</option>
                        <option value="cameriere">Cameriere</option>
                        <option value="admin">Amministratore</option>
                        <option value="super_admin">Tecnologia</option>
                    </select>

                    {/* Add User Button */}
                    {canManageSystem && (
                        <button 
                             onClick={handleCreateClick}
                             className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                        >
                            <FaUserPlus />
                            <span>Nuovo Utente</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="min-w-full w-full text-left text-sm text-gray-500 dark:text-gray-400">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-700 dark:text-gray-300">
                        <tr>
                            <th className="px-6 py-4 font-semibold">Utente</th>
                            <th className="px-6 py-4 font-semibold text-center">Ruolo</th>
                            <th className="px-6 py-4 font-semibold text-center">Aree Assegnate</th>
                            <th className="px-6 py-4 font-semibold text-center">Responsabilità</th>
                            <th className="px-6 py-4 font-semibold text-center">Stato</th>
                            <th className="px-6 py-4 font-semibold text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {loading ? (
                            <tr><td colSpan={6} className="p-6 text-center">Caricamento...</td></tr>
                        ) : filteredProfiles.length === 0 ? (
                            <tr><td colSpan={6} className="p-6 text-center">Nessun utente trovato.</td></tr>
                        ) : (
                            filteredProfiles.map(profile => (
                                <tr key={profile.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full overflow-hidden relative border border-gray-200 dark:border-gray-700 shadow-sm">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img 
                                                    src={getRoleAvatar(profile.global_role)} 
                                                    alt={profile.first_name || 'User'}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white">
                                                    {profile.first_name} {profile.last_name}
                                                </div>
                                                <div className="text-xs text-gray-500">{profile.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(profile.global_role)}`}>
                                            {getRoleLabel(profile.global_role)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center text-sm text-gray-600 dark:text-gray-300">
                                        {(() => {
                                             const assignedIds = profile.assigned_area_ids && profile.assigned_area_ids.length > 0 
                                                ? profile.assigned_area_ids 
                                                : (profile.assigned_area_id ? [profile.assigned_area_id] : []);

                                             if (assignedIds.length > 0) {
                                                  return assignedIds.map(id => allAreas.find(a => a.id === id)?.name || '?').join(', ');
                                             }
                                             
                                             // Fallbacks for AREAS column
                                             if (['super_admin', 'admin'].includes(profile.global_role)) return <span className="text-gray-500">Tutto</span>;
                                             if (profile.global_role === 'head_chef') return <span className="text-gray-500">Tutta la Cucina</span>;
                                             if (profile.global_role === 'maitre') return <span className="text-gray-500">Tutta la Sala</span>;

                                             // Unassigned Warning
                                              if (['cuoco', 'cameriere', 'staff'].includes(profile.global_role)) {
                                                  const dept = profile.global_role === 'cuoco' ? 'Cucina' : (profile.global_role === 'cameriere' ? 'Sala' : 'Staff');
                                                  return <span className="text-orange-500 italic text-xs">{dept} (Da Assegnare)</span>;
                                              }

                                             return <span className="text-gray-400 italic">-</span>;
                                        })()}
                                    </td>
                                    <td className="px-6 py-4 text-center text-sm">
                                         {(() => {
                                             // Logic for "Responsabilità" Column
                                             const isAssigned = (profile.assigned_area_ids && profile.assigned_area_ids.length > 0) || profile.assigned_area_id;
                                             // We treat 'manager' (and legacy 'editor') as Responsible
                                             const isManager = profile.role_in_area === 'manager' || profile.role_in_area === 'editor';

                                             if (isAssigned) {
                                                 if (isManager) {
                                                     return (
                                                        <span className="text-[10px] uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300">
                                                            Responsabile
                                                        </span>
                                                     );
                                                 } else {
                                                     return (
                                                        <span className="text-[10px] uppercase tracking-wider text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
                                                            Operativo
                                                        </span>
                                                     );
                                                 }
                                             }
                                             
                                             // Defaults for non-assigned roles
                                             if (['super_admin', 'admin'].includes(profile.global_role)) return <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">Globale</span>;
                                             if (['head_chef', 'maitre'].includes(profile.global_role)) return <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Supervisore</span>;

                                             return <span className="text-gray-300">-</span>;
                                         })()}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                       <span className={`inline-flex w-2.5 h-2.5 rounded-full ${profile.is_active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                    </td>
                                     <td className="px-6 py-4 text-right">
                                         {canManageSystem && (
                                             <div className="flex justify-end gap-1">
                                                 <button 
                                                     onClick={() => handleEditClick(profile)}
                                                     className="text-gray-400 hover:text-brand-600 transition-colors p-2"
                                                     title="Modifica"
                                                 >
                                                     <FaEdit />
                                                 </button>
                                                 <button
                                                     onClick={() => handleDeleteClick(profile)}
                                                     className="text-gray-400 hover:text-red-600 transition-colors p-2"
                                                     title="Elimina"
                                                 >
                                                     <div className="h-3 w-3"><svg fill="currentColor" viewBox="0 0 448 512"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/></svg></div>
                                                 </button>
                                             </div>
                                         )}
                                     </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal for Create/Edit - Condition updated to show if modal is open AND (mode is create OR profile is selected) */}
            {isModalOpen && (modalMode === 'create' || selectedProfile) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {modalMode === 'create' ? 'Nuovo Utente' : 'Modifica Utente'}
                        </h3>
                        
                        {errorMsg && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                                {errorMsg}
                            </div>
                        )}

                        <div className="space-y-3">
                             {/* Create Only Fields */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                <input 
                                    type="email" 
                                    value={formData.email}
                                    onChange={e => setFormData({...formData, email: e.target.value})}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                                    placeholder="utente@esempio.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {modalMode === 'create' ? 'Password Temporanea' : 'Nuova Password (Opzionale)'}
                                </label>
                                <div className="relative">
                                    <input 
                                        type={showPassword ? "text" : "password"} 
                                        value={formData.password}
                                        onChange={e => setFormData({...formData, password: e.target.value})}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 pr-10"
                                        placeholder={modalMode === 'create' ? "Lasciare vuoto per 'temp12345'" : "Lasciare vuoto per mantenere attuale"}
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
                                    >
                                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {modalMode === 'create' ? "L'utente dovrà cambiare la password al primo accesso." : "Compila solo se desideri reimpostare la password dell'utente."}
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome</label>
                                <input 
                                    type="text" 
                                    value={formData.first_name}
                                    onChange={e => setFormData({...formData, first_name: e.target.value})}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cognome</label>
                                <input 
                                    type="text" 
                                    value={formData.last_name}
                                    onChange={e => setFormData({...formData, last_name: e.target.value})}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ruolo</label>
                                <select 
                                    value={formData.global_role}
                                    onChange={e => {
                                        const newRole = e.target.value as UserRole;
                                        // Smart Assignment Logic
                                        let newParentId = selectedParentArea;

                                        // Auto-select Department based on Role
                                        if (['head_chef', 'cuoco'].includes(newRole)) {
                                            const cocina = allAreas.find(a => (a.name.toLowerCase() === 'cocina' || a.name.toLowerCase() === 'kitchen') && !a.parent_id);
                                            if (cocina) {
                                                newParentId = cocina.id;
                                                // For head chef, assignedIds could mean 'all'? But usually managed via logic.
                                                // For now, simple.
                                            }
                                        } else if (['maitre', 'cameriere'].includes(newRole)) {
                                            const sala = allAreas.find(a => (a.name.toLowerCase() === 'sala' || a.name.toLowerCase() === 'dining room') && !a.parent_id);
                                            if (sala) {
                                                newParentId = sala.id;
                                            }
                                        } else if (['admin', 'super_admin'].includes(newRole)) {
                                            newParentId = ""; // Optional for Admins
                                        }
                                        
                                        setSelectedParentArea(newParentId);
                                        setFormData(prev => ({ 
                                            ...prev, 
                                            global_role: newRole, 
                                            assigned_area_ids: [] // Reset specific assignments when role changes heavily? or keep? 
                                            // Resetting is safer to avoid invalid role-area combos.
                                        }));
                                    }}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                                >
                                    <option value="" disabled>Seleziona un ruolo...</option>
                                    <option value="head_chef">Chef</option>
                                    <option value="maitre">Capo Sala</option>
                                    <option value="cuoco">Cuoco</option>
                                    <option value="cameriere">Cameriere</option>
                                    <option value="admin">Amministratore</option>
                                    <option value="super_admin">Tecnologia</option>
                                </select>
                            </div>
                            {/* Area Dropdown */}
                            {/* Area Selection (Cascading) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dipartimento (Macro Area)</label>
                                <select 
                                    value={selectedParentArea}
                                    onChange={e => {
                                        setSelectedParentArea(e.target.value);
                                        // Reset specific areas when parent changes? Maybe not forcing logic, but safer.
                                        // Unless we want cross-department assignments (rare)
                                        setFormData(prev => ({ ...prev, assigned_area_ids: [] }));
                                    }}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 mb-2"
                                    disabled={['admin', 'super_admin'].includes(formData.global_role)} 
                                >
                                    <option value="">{['admin', 'super_admin'].includes(formData.global_role) ? 'Nessuna/Globale' : 'Seleziona Dipartimento...'}</option>
                                    {allAreas
                                        .filter(a => !a.parent_id && ['cocina', 'sala'].includes(a.name.toLowerCase()))
                                        .map(area => (
                                        <option key={area.id} value={area.id}>{area.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Multi-Select Sub-Areas */}
                            {selectedParentArea && allAreas.some(a => a.parent_id === selectedParentArea) && (
                                <div className="pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Seleziona Postazioni (Multipla)</label>
                                    
                                    <div className="space-y-2 max-h-40 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                                        {allAreas.filter(a => a.parent_id === selectedParentArea).map(area => (
                                            <label key={area.id} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-gray-600 rounded cursor-pointer transition-colors">
                                                <input 
                                                    type="checkbox"
                                                    checked={formData.assigned_area_ids?.includes(area.id) || false}
                                                    onChange={e => {
                                                        const checked = e.target.checked;
                                                        setFormData(prev => {
                                                            const current = prev.assigned_area_ids || [];
                                                            if (checked) {
                                                                return { ...prev, assigned_area_ids: [...current, area.id] };
                                                            } else {
                                                                return { ...prev, assigned_area_ids: current.filter(id => id !== area.id) };
                                                            }
                                                        });
                                                    }}
                                                    className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                                                    disabled={['head_chef', 'maitre'].includes(formData.global_role)} // Managers usually have all
                                                />
                                                <span className="text-sm text-gray-700 dark:text-gray-200">{area.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                    
                                    {/* Permission Toggle - Applies to ALL selected */}
                                    {(formData.assigned_area_ids && formData.assigned_area_ids.length > 0) && (
                                        <div className="mt-3 flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
                                            <input 
                                                type="checkbox"
                                                id="is_area_manager"
                                                checked={formData.is_area_manager || false}
                                                onChange={e => {
                                                    const val = e.target.checked;
                                                    setFormData(prev => ({...prev, is_area_manager: val}));
                                                }}
                                                className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                                            />
                                            <label htmlFor="is_area_manager" className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                                È Responsabile di Linea? (Permesso Modifica per le aree selezionate)
                                            </label>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Fallback for Head Chef / Maitre (Implied All) */}
                            {selectedParentArea && ['head_chef', 'maitre'].includes(formData.global_role) && (
                                <div className="text-sm text-gray-500 italic mt-2">
                                    * Questo ruolo ha supervisione completa automatica sul dipartimento.
                                </div>
                            )}

                            <div className="flex items-center gap-2 pt-2">
                                <input 
                                    type="checkbox" 
                                    id="active_status"
                                    checked={formData.is_active}
                                    onChange={e => setFormData({...formData, is_active: e.target.checked})}
                                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                />
                                <label htmlFor="active_status" className="text-sm text-gray-700 dark:text-gray-300">Utente Attivo</label>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                                Annulla
                            </button>
                            <button 
                                onClick={handleSave}
                                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm"
                            >
                                Salva Modifiche
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && profileToDelete && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 text-center">
                        <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-4">
                             <div className="h-6 w-6"><svg fill="currentColor" viewBox="0 0 448 512"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/></svg></div>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Elimina Utente?</h3>
                        <p className="text-sm text-gray-500">
                            Stai per eliminare <strong>{profileToDelete.first_name} {profileToDelete.last_name}</strong>. Questa azione potrebbe non essere reversibile se non hai accesso Admin.
                        </p>
                        
                        {errorMsg && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                                {errorMsg}
                            </div>
                        )}

                        <div className="flex justify-center gap-3 pt-4">
                            <button 
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                                Annulla
                            </button>
                            <button 
                                onClick={confirmDelete}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm"
                            >
                                Sì, Elimina
                            </button>
                        </div>
                    </div>
                 </div>
            )}

        </div>
    );
};
