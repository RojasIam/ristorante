import React from 'react';
import { FaClock } from 'react-icons/fa';

export const ScheduleManager: React.FC<{ station: string }> = ({ station }) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 text-center">
            <div className="flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-500 dark:text-blue-400">
                    <FaClock className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Gestione Orari: {station}</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                    Questa sezione sarà dedicata alla gestione dei turni e degli orari per questa postazione via.
                </p>
                <div className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-mono text-gray-600 dark:text-gray-300">
                    Funzionalità in arrivo...
                </div>
            </div>
        </div>
    );
};
