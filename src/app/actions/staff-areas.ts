'use server'

import { createAdminClient } from '@/utils/supabase/server-admin'
import { revalidatePath } from 'next/cache'

export async function addAreaAssignmentAction(userId: string, areaId: string, role: string) {
    try {
        const supabase = createAdminClient()

        // Check if assignment already exists
        const { data: existing } = await supabase
            .from('area_assignments')
            .select('id')
            .eq('user_id', userId)
            .eq('area_id', areaId)
            .single()

        if (existing) {
            // Update existing
            const { error } = await supabase
                .from('area_assignments')
                .update({ role_in_area: role })
                .eq('id', existing.id)
            
            if (error) throw error
        } else {
            // Create new
            const { error } = await supabase
                .from('area_assignments')
                .insert({
                    user_id: userId,
                    area_id: areaId,
                    role_in_area: role
                })
            
            if (error) throw error
        }

        revalidatePath('/dashboard/personale')
        return { success: true }
    } catch (error: unknown) {
        const err = error as Error;
        console.error('Error adding area assignment:', err)
        return { success: false, error: err.message }
    }
}

export async function removeAreaAssignmentAction(userId: string, areaId: string) {
    try {
        const supabase = createAdminClient()

        const { error } = await supabase
            .from('area_assignments')
            .delete()
            .eq('user_id', userId)
            .eq('area_id', areaId)

        if (error) throw error

        revalidatePath('/dashboard/personale')
        return { success: true }
    } catch (error: unknown) {
        const err = error as Error;
        console.error('Error removing area assignment:', err)
        return { success: false, error: err.message }
    }
}

export async function getAreaAssignmentsAction(userId: string) {
    try {
        const supabase = createAdminClient()

        const { data, error } = await supabase
            .from('area_assignments')
            .select(`
                area_id,
                role_in_area,
                areas (
                    id,
                    name,
                    parent_id
                )
            `)
            .eq('user_id', userId)

        if (error) throw error

        return { success: true, data }
    } catch (error: unknown) {
        const err = error as Error;
        console.error('Error fetching area assignments:', err)
        return { success: false, error: err.message }
    }
}
