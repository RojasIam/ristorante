"use client";
import React, { useState } from "react";
import { InventoryManager } from "@/components/cucina/InventoryManager";
import { DishManager } from "@/components/cucina/DishManager";
import { FaUtensils, FaBoxOpen } from "react-icons/fa";

// Client wrapper to handle tab state
export const StationTabs: React.FC<{ station: string }> = ({ station }) => {
    const [activeTab, setActiveTab] = useState<'dishes' | 'inventory'>('inventory');

    return (
        <div className="flex flex-col gap-6">
            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto no-scrollbar">
                <button 
                    onClick={() => setActiveTab('inventory')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'inventory' 
                        ? 'border-brand-600 text-brand-600 dark:text-brand-400' 
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                >
                    <FaBoxOpen />
                    Inventario & Stock
                </button>
                <button 
                    onClick={() => setActiveTab('dishes')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'dishes' 
                        ? 'border-brand-600 text-brand-600 dark:text-brand-400' 
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                >
                    <FaUtensils />
                    Menu & Piatti
                </button>
            </div>

            {/* Tab Content */}
            <div className="w-full">
                {activeTab === 'dishes' ? (
                    <DishManager station={station} />
                ) : (
                    <InventoryManager station={station} />
                )}
            </div>
        </div>
    );
};
