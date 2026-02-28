import { startOfWeek, isBefore } from 'date-fns';

export type GlobalRole = 'super_admin' | 'admin' | 'head_chef' | 'maitre' | 'staff' | 'cameriere' | 'cuoco';
export type AreaRole = 'manager' | 'viewer';

export interface UserPermissionProfile {
  id: string;
  global_role: GlobalRole;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  assignments: {
    area_id: string;
    role_in_area: AreaRole;
  }[];
}

/**
 * UTILS FOR PERMISSIONS
 * Following the rules from comofunciona.txt and USER request.
 */

export const Permissions = {
  /**
   * General Visibility: Everyone can see everything.
   * This utility focuses on EDIT/DELETE permissions.
   */

  // 1. Can Manage Staff / System Config
  canManageSystem: (role: GlobalRole) => {
    return ['super_admin', 'admin'].includes(role);
  },

  // 2. Can Edit Schedule
  canEditSchedule: (user: UserPermissionProfile, scheduleDate: Date) => {
    const { global_role } = user;
    
    // Admins have no restrictions
    if (['super_admin', 'admin'].includes(global_role)) return true;

    // Normal staff cannot edit schedules
    if (['staff', 'cuoco', 'cameriere'].includes(global_role)) return false;

    // Chef (Kitchen) and Capo Sala (Sala)
    // Restriction: Cannot edit past weeks.
    // We normalize to start of day and start of week to avoid time/timezone edge cases
    const today = new Date();
    const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const normalizedTarget = new Date(scheduleDate.getFullYear(), scheduleDate.getMonth(), scheduleDate.getDate());

    const currentWeekStart = startOfWeek(normalizedToday, { weekStartsOn: 1 });
    const targetWeekStart = startOfWeek(normalizedTarget, { weekStartsOn: 1 });

    // If target week is before current week, deny
    if (isBefore(targetWeekStart, currentWeekStart)) {
      return false; // Only Admins can edit past weeks
    }

    // Role specific restrictions
    // Maitre can only edit Sala schedules, Head Chef only Kitchen (Cucina)
    // This part depends on the module checking the permission. 
    // The user also mentioned Chef should manage "Gestione Totale".
    if (['head_chef', 'maitre'].includes(global_role)) {
      return true;
    }

    return false;
  },

  // 3. Can Edit Inventory / Products in an Area
  canEditAreaInventory: (user: UserPermissionProfile, areaId: string, areaName?: string) => {
    const { global_role, assignments } = user;

    // Admins: Full access
    if (['super_admin', 'admin'].includes(global_role)) return true;

    // Chef: Manage everything in KITCHEN (Cucina)
    if (global_role === 'head_chef') {
      // Check if area is kitchen-related (usually by name or parent)
      // For now, if we don't have area metadata, we might need to pass area context
      return true; // Logic to be refined based on module
    }

    // Capo Sala: Manage everything in SALA
    if (global_role === 'maitre') {
      return true;
    }

    // Responsables (Cuoco/Cameriere with manager role in area)
    const assignment = assignments.find(a => a.area_id === areaId);
    if (assignment && assignment.role_in_area === 'manager') {
      return true;
    }

    // Normal Staff: View only
    return false;
  },

  // 4. Can Manage a specific Area (for Responsables)
  canManageArea: (user: UserPermissionProfile, areaId: string) => {
    const { global_role, assignments } = user;

    if (['super_admin', 'admin'].includes(global_role)) return true;

    if (global_role === 'head_chef' || global_role === 'maitre') return true;

    const assignment = assignments.find(a => a.area_id === areaId);
    return assignment?.role_in_area === 'manager';
  }
};
