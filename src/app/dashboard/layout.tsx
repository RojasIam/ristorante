import AdminLayout from "@/components/layout/AdminLayout";
import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";

// Wraps the entire dashboard in the SidebarProvider and AdminLayout
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SidebarProvider>
          <AdminLayout>
            {children}
          </AdminLayout>
        </SidebarProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
