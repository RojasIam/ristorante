import Image from "next/image";
import React, { useState } from "react";
import { useSidebar } from "@/context/SidebarContext";
import { FaBars, FaUser, FaSignOutAlt } from "react-icons/fa";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

const AppHeader: React.FC = () => {
  const { user } = useAuth();
  const { toggleSidebar, toggleMobileSidebar, isMobile } = useSidebar();

  const getRoleLabel = (role?: string) => {
    switch (role) {
        case 'super_admin': return 'Tecnologia';
        case 'admin': return 'Amministratore';
        case 'head_chef': return 'Chef';
        case 'maitre': return 'Capo Sala';
        case 'staff': return 'Staff (Generico)';
        case 'cuoco': return 'Cuoco';
        case 'cameriere': return 'Cameriere';
        default: return role || 'Ruolo';
    }
  };

  const getRoleAvatar = (role?: string) => {
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

  const [isOpen, setIsOpen] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  
  const handleToggle = () => {
    if (isMobile) {
      toggleMobileSidebar();
    } else {
      toggleSidebar();
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Sign out error:", error);
    }
    router.push("/login"); // Redirect to login
    router.refresh(); // Clear client cache
  };

  return (
    <header className="sticky top-0 flex w-full bg-white border-b border-gray-200 z-30 dark:border-gray-800 dark:bg-gray-900 h-16">
      <div className="flex items-center justify-between w-full px-4 lg:px-6">
        
        {/* Left Side: Mobile Toggle & Logo */}
        <div className="flex items-center gap-3 lg:gap-4">
            <button
              className="flex items-center justify-center w-10 h-10 text-gray-500 border-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={handleToggle}
              aria-label="Toggle Sidebar"
            >
               <FaBars className="h-5 w-5" />
            </button>
            
            {/* Mobile Logo (Visible on mobile/tablet portrait) */}
            <div className="flex items-center gap-2 lg:hidden">
               <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 shadow-sm">
                   <span className="text-white font-bold text-sm">G</span>
               </div>
               <span className="font-bold text-gray-900 dark:text-white text-lg hidden sm:block">GARS</span>
            </div>
        </div>

        {/* Center: Spacer */}
        <div className="flex-1" />

        {/* Right Side: Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
           {/* Theme Toggle */}
           <ThemeToggleButton />



            {/* User Profile - Square Dropdown */}
            <div className="relative flex items-center gap-3 pl-2 sm:pl-4 sm:border-l border-gray-200 dark:border-gray-800">
                 <div className="text-right hidden lg:block">
                     <p className="text-sm font-bold text-gray-900 dark:text-white leading-none">
                        {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Ospite'}
                     </p>
                     <p className="text-[10px] text-gray-500 uppercase font-medium mt-0.5">
                        {getRoleLabel(user?.global_role)}
                     </p>
                 </div>
                
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 overflow-hidden border border-gray-200 dark:border-gray-700 dark:bg-gray-800 ring-2 ring-transparent hover:ring-brand-100 transition-all focus:outline-none active:scale-95 relative"
                >
                    <Image 
                        src={user?.avatar_url || getRoleAvatar(user?.global_role)} 
                        alt="User" 
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                        unoptimized
                    />
                </button>

                {/* Dropdown Menu */}
                {isOpen && (
                    <div className="absolute right-0 top-12 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                        <div className="p-2">
                             <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 mb-1 lg:hidden">
                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                    {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Ospite'}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {getRoleLabel(user?.global_role)}
                                </p>
                             </div>
                             
                             <Link 
                                href="/dashboard/profile" // Adjust valid route if needed
                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
                                onClick={() => setIsOpen(false)}
                             >
                                <FaUser className="text-gray-400" />
                                <span>Mi Perfil</span>
                             </Link>
                             
                             <button 
                                onClick={handleSignOut}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors mt-1"
                             >
                                <FaSignOutAlt />
                                <span>Cerrar Sesión</span>
                             </button>
                        </div>
                    </div>
                )}

                {/* Overlay for closing */}
                {isOpen && (
                    <div 
                        className="fixed inset-0 -z-1" 
                        onClick={() => setIsOpen(false)}
                    />
                )}
           </div>
        </div>

      </div>
    </header>
  );
};

export default AppHeader;
