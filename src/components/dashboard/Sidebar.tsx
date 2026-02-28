"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  FaCube, 
  FaHome, 
  FaUtensils, 
  FaWineGlass, 
  FaBoxOpen, 
  FaUsers, 
  FaCog, 
  FaSignOutAlt 
} from "react-icons/fa";
import { BiSolidDashboard } from "react-icons/bi";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: BiSolidDashboard },
  { label: "Cucina", href: "/dashboard/cucina", icon: FaUtensils },
  { label: "Sala", href: "/dashboard/sala", icon: FaWineGlass },
  { label: "Magazzino", href: "/dashboard/magazzino", icon: FaBoxOpen },
  { label: "Personale", href: "/dashboard/personale", icon: FaUsers },
  { label: "Impostazioni", href: "/dashboard/settings", icon: FaCog },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-zinc-900 text-white flex flex-col border-r border-zinc-800 shadow-xl z-50">
      
      {/* Brand Section */}
      <div className="flex h-16 items-center px-6 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
            <FaCube className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold tracking-widest text-sm text-zinc-100">GARS SYSTEM</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        
        <div className="px-3 mb-2">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Menu Principale</p>
        </div>

        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-white text-zinc-900 shadow-sm" 
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? "text-zinc-900" : "text-zinc-500 group-hover:text-white")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer / User Profile Stub */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
          <form action="/auth/signout" method="post">
            <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
                <FaSignOutAlt className="h-4 w-4" />
                <span>Disconnetti</span>
            </button>
          </form>
      </div>
    </aside>
  );
}
