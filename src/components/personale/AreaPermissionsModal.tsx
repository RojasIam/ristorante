'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { FaTrash } from 'react-icons/fa';
import { getAreaAssignmentsAction, addAreaAssignmentAction, removeAreaAssignmentAction } from '@/app/actions/staff-areas';

interface Area {
    id: string;
    name: string;
    parent_id: string | null;
}

interface AreaAssignment {
    area_id: string;
    role_in_area: string;
    areas: {
        id: string;
        name: string;
        parent_id: string | null;
    };
}

interface AreaPermissionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    userName: string;
    allAreas: Area[];
    primaryAreaId: string | null; // To highlight the primary one
}

export const AreaPermissionsModal: React.FC<AreaPermissionsModalProps> = ({
    isOpen,
    onClose,
    userId,
    userName,
    allAreas,
    primaryAreaId
}) => {
    const [assignments, setAssignments] = useState<AreaAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // New Assignment State
    const [selectedNewAreaId, setSelectedNewAreaId] = useState("");
    const [isNewAreaManager, setIsNewAreaManager] = useState(false);
    const [adding, setAdding] = useState(false);

    const fetchAssignments = useCallback(async () => {
        setLoading(true);
        const result = await getAreaAssignmentsAction(userId);
        if (result.success && result.data) {
            setAssignments(result.data as any[]);
        } else {
            setError(result.error || "Errore nel caricamento dei permessi.");
        }
        setLoading(false);
    }, [userId]);

    useEffect(() => {
        if (isOpen && userId) {
            fetchAssignments();
        }
    }, [isOpen, userId, fetchAssignments]);

    const handleAdd = async () => {
        if (!selectedNewAreaId) return;
        setAdding(true);
        setError(null);

        const role = isNewAreaManager ? 'editor' : 'viewer';
        const result = await addAreaAssignmentAction(userId, selectedNewAreaId, role);

        if (result.success) {
            await fetchAssignments();
            setSelectedNewAreaId("");
            setIsNewAreaManager(false);
        } else {
            setError(result.error || "Errore nell'aggiunta del permesso.");
        }
        setAdding(false);
    };

    const handleRemove = async (areaId: string) => {
        // Prevent removing primary area? Or just warn?
        // Ideally Primary Area is managed in the main form.
        if (areaId === primaryAreaId) {
            if (!confirm("Questa è l'area principale dell'utente. Sei sicuro di voler rimuovere il permesso esplicito?")) return;
        }

        const result = await removeAreaAssignmentAction(userId, areaId);
        if (result.success) {
            setAssignments(prev => prev.filter(a => a.area_id !== areaId));
        } else {
            setError(result.error || "Errore nella rimozione.");
        }
    };

    if (!isOpen) return null;

    // Filter out areas already assigned so they don't appear in dropdown
    const availableAreas = allAreas.filter(a => !assignments.some(assign => assign.area_id === a.id));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95">
                <div className="flex justify-between items-center border-b pb-3 border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        Permessi Aree: {userName}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        ✕
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    {/* Add New Area */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Aggiungi Permesso Area</label>
                        <div className="flex flex-col gap-3">
                            <select
                                value={selectedNewAreaId}
                                onChange={e => setSelectedNewAreaId(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                            >
                                <option value="">Seleziona Area...</option>
                                {availableAreas.map(area => (
                                    <option key={area.id} value={area.id}>{area.name}</option>
                                ))}
                            </select>
                            
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="checkbox"
                                        id="new_area_manager"
                                        checked={isNewAreaManager}
                                        onChange={e => setIsNewAreaManager(e.target.checked)}
                                        className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                                    />
                                    <label htmlFor="new_area_manager" className="text-sm text-gray-700 dark:text-gray-300">
                                        È Responsabile di Linea? (Modifica)
                                    </label>
                                </div>
                                <button 
                                    onClick={handleAdd}
                                    disabled={!selectedNewAreaId || adding}
                                    className="px-3 py-1.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {adding ? 'Aggiunta...' : 'Aggiungi'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* List Assignments */}
                    <div className="max-h-60 overflow-y-auto space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Aree Assegnate</label>
                        {loading ? (
                            <p className="text-sm text-gray-400">Caricamento...</p>
                        ) : assignments.length === 0 ? (
                            <p className="text-sm text-gray-400 italic">Nessun permesso aggiuntivo.</p>
                        ) : (
                            assignments.map(assign => (
                                <div key={assign.area_id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
                                    <div>
                                        <div className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                            {assign.areas.name}
                                            {assign.area_id === primaryAreaId && (
                                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full dark:bg-blue-900/30 dark:text-blue-300">Principale</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            Ruolo: <span className={assign.role_in_area === 'editor' || assign.role_in_area === 'manager' ? 'font-bold text-brand-600' : ''}>
                                                {assign.role_in_area === 'editor' ? 'Responsabile (Modifica)' : 
                                                 assign.role_in_area === 'manager' ? 'Manager' : 'Visualizzatore'}
                                            </span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleRemove(assign.area_id)}
                                        className="text-gray-400 hover:text-red-600 p-2"
                                        title="Rimuovi Permesso"
                                    >
                                        <FaTrash size={14} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        Chiudi
                    </button>
                </div>
            </div>
        </div>
    );
};
