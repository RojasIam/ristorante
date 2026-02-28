"use client";
import React from "react";
import { FaCheckCircle, FaCircle } from "react-icons/fa";

type PrepItem = {
    id: string;
    name: string;
    quantity: string;
    status: 'pending' | 'in_progress' | 'completed';
    priority: 'high' | 'normal';
};

const mockPrepList: PrepItem[] = [
    { id: '1', name: 'Sugo Pomodorini', quantity: '5 Lt', status: 'completed', priority: 'normal' },
    { id: '2', name: 'Pesto Genovese', quantity: '2 Kg', status: 'in_progress', priority: 'high' },
    { id: '3', name: 'Besciamella', quantity: '10 Lt', status: 'pending', priority: 'normal' },
    { id: '4', name: 'Ragù Bolognese', quantity: '15 Lt', status: 'pending', priority: 'high' },
];

export const PrepList: React.FC = () => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">Lista Preparazioni (Mise en place)</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Attività da completare per il servizio.</p>
            </div>
            
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-700 dark:text-gray-300">
                        <tr>
                            <th className="px-6 py-4 font-medium">Item</th>
                            <th className="px-6 py-4 font-medium">Quantità</th>
                            <th className="px-6 py-4 font-medium">Priorità</th>
                            <th className="px-6 py-4 font-medium">Stato</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {mockPrepList.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{item.name}</td>
                                <td className="px-6 py-4">{item.quantity}</td>
                                <td className="px-6 py-4">
                                    {item.priority === 'high' ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-900/30">
                                            Alta
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                                            Normale
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {item.status === 'completed' && (
                                        <span className="flex items-center gap-2 text-success-600 dark:text-success-500">
                                            <FaCheckCircle /> Completato
                                        </span>
                                    )}
                                    {item.status === 'in_progress' && (
                                        <span className="flex items-center gap-2 text-warning-600 dark:text-warning-500">
                                            <FaCircle className="text-[10px] animate-pulse" /> In Corso
                                        </span>
                                    )}
                                    {item.status === 'pending' && (
                                        <span className="flex items-center gap-2 text-gray-400">
                                            <FaCircle className="text-[10px]" /> In Attesa
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
