"use client";

import { useSidebar } from "@/context/SidebarContext"; // Correct context path
import AppHeader from "@/components/layout/AppHeader"; // Correct component path
import AppSidebar from "@/components/layout/AppSidebar"; // Correct component path
import Backdrop from "@/components/layout/Backdrop"; // Correct component path
import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-gray-500 animate-pulse">Caricamento sessione...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Calculate main content margin dynamically based on sidebar state
  // This matches the logic from TailAdmin's layout.tsx
  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
    ? "lg:ml-[220px]"
    : "lg:ml-[70px]";

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      {/* Sidebar and Backdrop */}
      <AppSidebar />
      <Backdrop />
      
      {/* Main Content Area */}
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}
      >
        {/* Header */}
        <AppHeader />
        
        {/* Page Content */}
        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6 lg:p-8">
            {children}
        </div>
      </div>
    </div>
  );
}
