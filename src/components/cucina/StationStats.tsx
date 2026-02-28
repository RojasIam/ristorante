"use client";
import React from "react";
import { FaUsers, FaBoxOpen, FaClipboardList, FaExclamationTriangle } from "react-icons/fa";

type StationStatsProps = {
  station: string;
};

export const StationStats: React.FC<StationStatsProps> = ({ station }) => {
  // Mock Data based on station
  const stats = [
    { 
        title: "Staff in Turno", 
        value: "3", 
        sub: "Mario, Luigi, Giovanni", 
        icon: FaUsers, 
        color: "text-brand-500", 
        bg: "bg-brand-50 dark:bg-brand-500/10" 
    },
    { 
        title: "Produzione", 
        value: "85%", 
        sub: "Mise en place quasi completa", 
        icon: FaClipboardList, 
        color: "text-success-600", 
        bg: "bg-success-50 dark:bg-success-500/10" 
    },
    { 
        title: "Stock Alert", 
        value: "1", 
        sub: "Sugo Pomodoro (Low)", 
        icon: FaExclamationTriangle, 
        color: "text-warning-600", 
        bg: "bg-warning-50 dark:bg-warning-500/10" 
    },
    { 
        title: "Items Totali", 
        value: "24", 
        sub: "Ingredienti attivi", 
        icon: FaBoxOpen, 
        color: "text-blue-light-600", 
        bg: "bg-blue-light-50 dark:bg-blue-light-500/10" 
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
            <div key={index} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${stat.bg}`}>
                        <Icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                </div>
                <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</h3>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.title}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">{stat.sub}</p>
                </div>
            </div>
        )
      })}
    </div>
  );
};
