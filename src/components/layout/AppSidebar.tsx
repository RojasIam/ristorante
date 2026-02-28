"use client";
import React, { useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { createClient } from "@/utils/supabase/client";
import {
  FaUtensils,
  FaSignOutAlt,
  FaWineGlass,
  FaEllipsisH
} from "react-icons/fa";
import { BiSolidDashboard } from "react-icons/bi";

type NavItem = {
  name?: string;
  icon?: React.ReactNode;
  path?: string;
  roles?: string[];
  type?: 'item' | 'separator';
  label?: string;
};

// GARS System Navigation
const navItems: NavItem[] = [
  {
    type: 'item',
    name: "Dashboard",
    path: "/dashboard",
  },
  {
    type: 'item',
    name: "Personale",
    path: "/dashboard/personale",
  },
  
  // CUCINA SECTION
  { type: 'separator', label: 'Cucina', icon: <FaUtensils /> },
  {
    type: 'item',
    name: "Orario",
    path: "/dashboard/cucina/orario",
  },
  {
    type: 'item',
    name: "Gestione Totale",
    path: "/dashboard/cucina/totale",
    roles: ['super_admin', 'admin', 'head_chef'],
  },
  { type: 'item', name: "Antipasti", path: "/dashboard/cucina/antipasti" },
  { type: 'item', name: "Primi", path: "/dashboard/cucina/primi" },
  { type: 'item', name: "Secondi", path: "/dashboard/cucina/secondi" },
  { type: 'item', name: "Dolci", path: "/dashboard/cucina/dolci" },
  { type: 'item', name: "Salumeria", path: "/dashboard/cucina/salumeria" },

  // SALA SECTION
  { type: 'separator', label: 'Sala', icon: <FaWineGlass /> },
  {
    type: 'item',
    name: "Orario",
    path: "/dashboard/sala/orario",
  },
];

import { useAuth } from "@/context/AuthContext";

const AppSidebar: React.FC = () => {
  const pathname = usePathname();
  const { isExpanded, isHovered, setIsHovered, isMobileOpen } = useSidebar();
  const { user } = useAuth();
  const supabase = createClient();
  const router = useRouter();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Sign out error:", error);
    }
    router.push("/login"); // Redirect to login
    router.refresh(); // Clear client cache
  };

  const isActive = useCallback((path: string) => path === pathname, [pathname]);

  return (
    <aside
      className={`fixed flex flex-col top-0 left-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 h-full transition-all duration-300 ease-in-out z-50
        ${
          isExpanded || isMobileOpen ? "w-[220px]" : isHovered ? "w-[220px]" : "w-[70px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* LOGO AREA */}
      <div className="py-8 px-4 overflow-hidden">
        <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="relative shrink-0 w-10 h-10 transition-transform duration-300 group-hover:scale-110">
                <Image 
                    src="/logo-gars.webp" 
                    alt="Logo" 
                    width={40}
                    height={40}
                    className="w-full h-full object-contain"
                />
            </div>
            
            {(isExpanded || isHovered || isMobileOpen) && (
                <div className="flex flex-col animate-in slide-in-from-left-2 duration-300">
                    <span className="text-[10px] uppercase tracking-[0.25em] font-black text-gray-500 dark:text-gray-400 mt-0.5">
                        Management <span style={{ color: '#0297c2' }}>Solution</span>
                    </span>
                </div>
            )}
        </Link>
      </div>

      {/* NAVIGATION */}
      <div className="flex flex-col overflow-y-auto px-4 duration-300 ease-linear no-scrollbar flex-1 pb-10">
        <nav className="mb-6">
            <h2 className={`mb-4 text-xs uppercase flex items-center leading-5 text-gray-400 font-semibold gap-2 ${
                  !isExpanded && !isHovered ? "justify-center" : "justify-start"
                }`}>
                {(isExpanded || isHovered || isMobileOpen) ? (
                    <>
                        <BiSolidDashboard className="text-sm" />
                        <span>Menu Principale</span>
                    </>
                ) : <FaEllipsisH />}
            </h2>
            
            <ul className="flex flex-col gap-1">
                {navItems
                  .filter(nav => !nav.roles || (user && nav.roles.includes(user.global_role)))
                  .map((nav, index) => {
                    if (nav.type === 'separator') {
                        if (!isExpanded && !isHovered && !isMobileOpen) {
                            return <hr key={`sep-${index}`} className="my-3 border-gray-100 dark:border-gray-800 mx-2" />;
                        }
                        return (
                            <li key={`sep-${index}`} className="mt-5 mb-2 px-3">
                                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    {nav.icon && <span className="text-xs opacity-80">{nav.icon}</span>}
                                    {nav.label}
                                    <div className="h-px bg-linear-to-r from-gray-200 dark:from-gray-800 to-transparent flex-1" />
                                </span>
                            </li>
                        );
                    }

                    return (
                        <li key={`${nav.name}-${index}`}>
                            <Link href={nav.path!} className={`menu-item group ${
                                isActive(nav.path!) ? "menu-item-active" : "menu-item-inactive"
                            } ${!isExpanded && !isHovered ? "justify-center" : "justify-start"}`}>
                                {nav.icon && (
                                    <span className={`${isActive(nav.path!) ? "menu-item-icon-active" : "menu-item-icon-inactive"}`}>
                                        {nav.icon}
                                    </span>
                                )}
                                {(isExpanded || isHovered || isMobileOpen) && (
                                    <span className={`menu-item-text ${!nav.icon ? 'pl-2' : ''}`}>{nav.name}</span>
                                )}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
      </div>

      {/* FOOTER / USER */}
      {(isExpanded || isHovered || isMobileOpen) && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 mb-4">
            <button 
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200 transition-colors"
                type="button"
            >
                <FaSignOutAlt className="h-5 w-5" />
                <span>Esci</span>
            </button>
          </div>
      )}
    </aside>
  );
};

export default AppSidebar;

