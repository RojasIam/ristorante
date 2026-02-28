"use client"

import { FaBell, FaSearch, FaUserCircle } from "react-icons/fa";

export function DashboardHeader({ userRole }: { userRole?: string }) {
  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-zinc-200 bg-white px-6 shadow-sm">
        
        {/* Left: Breadcrumbs / Page Title (Placeholder for now) */}
        <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-zinc-900 tracking-tight">
                Panoramica
            </h2>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
            {/* Search Bar - Visual Only */}
            <div className="hidden md:flex items-center rounded-full bg-zinc-100 px-4 py-1.5 border border-zinc-200">
                <FaSearch className="h-3 w-3 text-zinc-400" />
                <input 
                    type="text" 
                    placeholder="Cerca..." 
                    className="ml-2 bg-transparent text-sm outline-none text-zinc-700 placeholder:text-zinc-400 w-48"
                />
            </div>

            {/* Notifications */}
            <button className="relative rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors">
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 border-2 border-white"></span>
                <FaBell className="h-5 w-5" />
            </button>

            {/* Profile */}
            <div className="flex items-center gap-3 pl-4 border-l border-zinc-200">
                <div className="text-right hidden md:block">
                    <p className="text-sm font-bold text-zinc-900 leading-none">Admin User</p>
                    <p className="text-[10px] text-zinc-500 uppercase font-semibold mt-0.5">{userRole || 'STAFF'}</p>
                </div>
                <div className="h-9 w-9 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-500">
                    <FaUserCircle className="h-6 w-6" />
                </div>
            </div>
        </div>
    </header>
  );
}
