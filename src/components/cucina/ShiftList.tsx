"use client";
import React from "react";
// import Image from "next/image"; // Removed Image because we are using a span placeholder to avoid unconfigured host errors
import { FaUserCircle } from "react-icons/fa";

export const ShiftList: React.FC = () => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">Turno Attuale</h3>
            <div className="space-y-4">
                {/* Cuoco Responsabile */}
                <div className="flex items-center gap-4 p-3 bg-brand-50 dark:bg-brand-900/10 border border-brand-100 dark:border-brand-900/20 rounded-lg">
                     <div className="h-10 w-10 text-brand-500 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center border border-brand-200 dark:border-brand-800">
                        <FaUserCircle className="h-6 w-6" />
                     </div>
                     <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">Giovanni Bianchi</p>
                        <p className="text-xs text-brand-600 dark:text-brand-400 font-medium">Capo Partita (Primi)</p>
                     </div>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-700 my-2"></div>

                {/* Staff */}
                {['Mario Rossi', 'Luigi Verdi'].map((name, i) => (
                    <div key={i} className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                                <span className="text-xs font-bold">{name.charAt(0)}</span>
                            </div>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{name}</span>
                         </div>
                         <span className="h-2 w-2 rounded-full bg-success-500"></span>
                    </div>
                ))}
            </div>
        </div>
    );
};
