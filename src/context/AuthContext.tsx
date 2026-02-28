"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Permissions, UserPermissionProfile, GlobalRole, AreaRole } from '@/utils/permissions';

interface AuthContextType {
  user: UserPermissionProfile | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  hasPermission: {
    canManageSystem: () => boolean;
    canEditSchedule: (date: Date) => boolean;
    canEditAreaInventory: (areaId: string) => boolean;
    canManageArea: (areaId: string) => boolean;
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserPermissionProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const userRef = React.useRef<UserPermissionProfile | null>(null);
  const supabase = createClient();

  // Sync ref with state
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const fetchUserProfile = async (showLoading = false) => {
    try {
      // Only show loading if requested OR if we don't have a user yet
      if (showLoading && !userRef.current) {
        setLoading(true);
      }
      
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Fetch Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, global_role, first_name, last_name, avatar_url')
        .eq('id', authUser.id)
        .single();

      // Fetch Area Assignments
      const { data: assignments } = await supabase
        .from('area_assignments')
        .select('area_id, role_in_area')
        .eq('user_id', authUser.id);

      if (profile) {
        const profileData: UserPermissionProfile = {
          id: profile.id,
          global_role: profile.global_role as GlobalRole,
          first_name: profile.first_name,
          last_name: profile.last_name,
          avatar_url: profile.avatar_url,
          assignments: (assignments || []).map((a: { area_id: string; role_in_area: string }) => ({
            area_id: a.area_id,
            role_in_area: a.role_in_area as AreaRole
          }))
        };
        setUser(profileData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching auth user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch always shows loading if there's no user
    fetchUserProfile(true);
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
        // Events like TOKEN_REFRESHED or focus transitions shouldn't show loading if we already have a user
        // We only want visible loading if it's a fresh SIGNED_IN event and we don't have user data yet
        const isLoggingIn = event === 'SIGNED_IN' && !userRef.current;
        
        // Fetch profile silently unless it's a transition from "no user" to "logged in"
        fetchUserProfile(isLoggingIn);
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasPermission = {
    canManageSystem: () => user ? Permissions.canManageSystem(user.global_role) : false,
    canEditSchedule: (date: Date) => user ? Permissions.canEditSchedule(user, date) : false,
    canEditAreaInventory: (areaId: string) => user ? Permissions.canEditAreaInventory(user, areaId) : false,
    canManageArea: (areaId: string) => user ? Permissions.canManageArea(user, areaId) : false,
  };

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser: fetchUserProfile, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
