'use server'

import { createAdminClient } from '@/utils/supabase/server-admin'
import { revalidatePath } from 'next/cache'

import { AdminUserAttributes } from '@supabase/supabase-js'

type UserRole = 'super_admin' | 'admin' | 'head_chef' | 'maitre' | 'staff' | 'cameriere' | 'cuoco';

interface CreateStaffUserData {
  email: string
  password?: string
  first_name: string
  last_name: string
  global_role: UserRole
  is_active: boolean
  assigned_area_ids?: string[]
  is_area_manager?: boolean
}

export async function createStaffUserAction(data: CreateStaffUserData) {
  try {
    const supabase = createAdminClient()

    // 1. Create Auth User (Admin Level - Bypasses Rate Limits)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password || 'temp12345',
      email_confirm: true, // Auto-confirm the email so they can login immediately
      user_metadata: {
        first_name: data.first_name,
        last_name: data.last_name,
      }
    })

    if (authError) {
      console.error('Error in Admin Create User as:', authError)
      return { success: false, error: authError.message }
    }

    if (!authData.user) {
      return { success: false, error: 'User creation failed silently.' }
    }

    // 2. Update Profile Role & Info
    // The trigger might have created a row, but we enforce the correct role here immediately
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        first_name: data.first_name,
        last_name: data.last_name,
        global_role: data.global_role,
        is_active: data.is_active,
        assigned_area_id: data.assigned_area_ids?.[0] || null // Persist first area as primary for compatibility
      })
      .eq('id', authData.user.id)

    if (profileError) {
      console.warn('Profile update failed, trying upsert:', profileError)
      
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
            id: authData.user.id,
            email: data.email, 
            first_name: data.first_name,
            last_name: data.last_name,
            global_role: data.global_role,
            is_active: data.is_active,
            assigned_area_id: data.assigned_area_ids?.[0] || null
        })

      if (upsertError) {
          console.error('Profile upsert failed:', upsertError)
          return { success: false, error: 'User created but profile sync failed: ' + upsertError.message }
      }
    }

    if (data.assigned_area_ids && data.assigned_area_ids.length > 0) {
         // Determine Role In Area based on explicit flag
         let roleInArea = 'viewer';
         
         if (['head_chef', 'maitre', 'admin', 'super_admin'].includes(data.global_role)) {
             roleInArea = 'manager';
         } else if (data.is_area_manager) {
             roleInArea = 'manager'; // Use manager
         }
         
         console.log(`[CreateStaff] Assigning areas for ${data.email}. Role: ${roleInArea}. Areas: ${data.assigned_area_ids.join(', ')}`);

         // Clear previous assignments to enforce new selection
         await supabase.from('area_assignments').delete().eq('user_id', authData.user.id);
         
         const assignments = data.assigned_area_ids.map(areaId => ({
            user_id: authData.user.id,
            area_id: areaId,
            role_in_area: roleInArea
         }));

         const { error: assignError } = await supabase.from('area_assignments').insert(assignments);
         if (assignError) {
             console.error('Error assigning areas:', assignError);
             return { success: false, error: "Utente creato ma errore assegnazione aree: " + assignError.message };
         }
    }

    revalidatePath('/dashboard/personale')
    return { success: true }

  } catch (error: unknown) {
    console.error('Server Action Error:', error)
    const err = error as Error;
    if (err.message && err.message.includes('CONFIG_ERROR')) {
        return { success: false, error: 'Missing Server Configuration: Add SUPABASE_SERVICE_ROLE_KEY to .env' }
    }
    return { success: false, error: err.message || 'Unknown Server Error' }
  }
}

export async function deleteStaffUserAction(userId: string) {
    try {
        const supabase = createAdminClient()

        // 1. Delete Auth User (Cascades to profile usually, but we check)
        const { error: authError } = await supabase.auth.admin.deleteUser(userId)

        if (authError) {
             console.error('Error deleting auth user:', authError)
             return { success: false, error: authError.message }
        }

        // 2. Explicitly ensure profile is deleted if cascade didn't work (optional but safe)
        // With Service Role we bypass RLS so we can force delete
        const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId)
        
        if (profileError) {
             console.warn('Profile delete warning (might have cascaded already):', profileError)
        }

        revalidatePath('/dashboard/personale')
        return { success: true }

    } catch (error: unknown) {
        const err = error as Error;
        console.error('Server Action Error (Delete):', err)
        return { success: false, error: err.message || 'Unknown Server Error' }
    }
}

interface UpdateStaffUserData {
  id: string
  email?: string
  first_name: string
  last_name: string
  global_role: UserRole
  is_active: boolean
  password?: string
  assigned_area_ids?: string[]
  is_area_manager?: boolean
}

export async function updateStaffUserAction(data: UpdateStaffUserData) {
    try {
        const supabase = createAdminClient()

        // Update Profile
        const { error } = await supabase
            .from('profiles')
            .update({
                email: data.email, // Ensure email is upgraded in profile too
                first_name: data.first_name,
                last_name: data.last_name,
                global_role: data.global_role,
                is_active: data.is_active,
                // Only update if provided (handled by caller logic usually, but here we can set it if defined)
                // Update primary to first selected
                ...(data.assigned_area_ids !== undefined ? { assigned_area_id: data.assigned_area_ids[0] || null } : {}) 
            })
            .eq('id', data.id)

        if (error) {
            console.error('Error updating profile:', error)
            return { success: false, error: error.message }
        }
        
        // Optionally update Auth Metadata too
        const authUpdates: AdminUserAttributes = {
             email: data.email,
             email_confirm: true, // Auto-confirm the new email
             user_metadata: {
                first_name: data.first_name,
                last_name: data.last_name
             }
        }
        
        if (data.password && data.password.trim().length > 0) {
            authUpdates.password = data.password.trim();
        }

        const { error: authError } = await supabase.auth.admin.updateUserById(data.id, authUpdates)
        
        if (authError) {
             console.error('Error updating auth data:', authError)
             return { success: false, error: "Profile updated, but password failed: " + authError.message }
        }

        // Update Area Assignments
        if (data.assigned_area_ids !== undefined) {
             // 1. Determine Role
             let roleInArea = 'viewer';
         if (['head_chef', 'maitre', 'admin', 'super_admin'].includes(data.global_role)) {
             roleInArea = 'manager';
         } else if (data.is_area_manager) {
             roleInArea = 'manager'; // Use manager for line responsibles too
         }
             
             console.log(`[UpdateStaff] Updating areas for userId ${data.id}. Role: ${roleInArea}. Areas: ${data.assigned_area_ids.join(', ')}`);

             // 2. Clear existing assignments logic is preferred for "Replace All" behavior in multi-select
             // The user wants simple "what I check is what they have".
             // So we wipe and recreate.
             
             await supabase.from('area_assignments').delete().eq('user_id', data.id);

             if (data.assigned_area_ids.length > 0) {
                 const assignments = data.assigned_area_ids.map(areaId => ({
                     user_id: data.id,
                     area_id: areaId,
                     role_in_area: roleInArea
                 }));

                 const { error: insertError } = await supabase.from('area_assignments').insert(assignments);
                 if (insertError) {
                     console.error('Error updating area assignments:', insertError);
                     return { success: false, error: "Errore assegnazione aree: " + insertError.message };
                 }
             }
        }

        revalidatePath('/dashboard/personale')
        return { success: true }

    } catch (error: unknown) {
        const err = error as Error;
        console.error('Server Action Error (Update):', err)
        return { success: false, error: err.message || 'Unknown Server Error' }
    }
}
