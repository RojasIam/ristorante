'use server'

import { createAdminClient } from '@/utils/supabase/server-admin'
import { revalidatePath } from 'next/cache'

export async function fixAreasHierarchyAction() {
  const supabase = createAdminClient()
  console.log("Starting Area Hierarchy Fix...")

  // 1. Ensure Roots Exist
  let cocinaId: string | null = null
  let salaId: string | null = null

  // Get or Create Cocina
  let { data: cocinaData } = await supabase.from('areas').select('id').eq('slug', 'cocina').maybeSingle();
  if (!cocinaData) {
      const { data: newCocina, error } = await supabase.from('areas').insert({ name: 'Cocina', slug: 'cocina', type: 'department' }).select('id').single();
      if (error) { 
          console.error("Error creating Cocina:", error);
          // Try to fetch again in case of race condition or just being silly
          const { data: retry } = await supabase.from('areas').select('id').eq('slug', 'cocina').maybeSingle();
          cocinaId = retry?.id || null;
      } else {
          cocinaId = newCocina.id;
      }
  } else {
      cocinaId = cocinaData.id;
  }

  // Get or Create Sala
  const { data: salaData } = await supabase.from('areas').select('id').eq('slug', 'sala').single()
  if (salaData) {
    salaId = salaData.id
  } else {
    const { data: newSala } = await supabase.from('areas').insert({ name: 'Sala', slug: 'sala', type: 'department' }).select().single()
    if (newSala) salaId = newSala.id
  }

  if (!cocinaId) return { success: false, error: 'Could not resolve Cocina ID' }

  // 2. Assign Children to Cocina
  const kitchenSubareas = ['primi', 'secondi', 'dolci', 'antipasto', 'salumeria']
  // Note: handling 'antipasti' duplicate specifically
  
  for (const slug of kitchenSubareas) {
      // Find the area
      const { data: area } = await supabase.from('areas').select('id').ilike('slug', slug).maybeSingle()
      
      if (area) {
          // Update parent
          await supabase.from('areas').update({ parent_id: cocinaId, type: 'production_line' }).eq('id', area.id)
      } else {
          // Create if missing
          await supabase.from('areas').insert({ 
              name: slug.charAt(0).toUpperCase() + slug.slice(1), 
              slug: slug, 
              type: 'production_line',
              parent_id: cocinaId
          })
      }
  }

  // 3. Handle specific duplicate 'Antipasti' (plural) if it exists and is different from 'Antipasto'
  // We want to merge or delete 'Antipasti' if 'Antipasto' is the standard.
  const { data: antipasti } = await supabase.from('areas').select('id').eq('slug', 'antipasti').maybeSingle()
  if (antipasti) {
      // Check if we have antipasto
      const { data: antipasto } = await supabase.from('areas').select('id').eq('slug', 'antipasto').maybeSingle()
      if (antipasto && antipasti.id !== antipasto.id) {
          // We have both. Delete Antipasti (duplicate)
          await supabase.from('areas').delete().eq('id', antipasti.id)
      }
  }

  revalidatePath('/dashboard/personale')
  return { success: true }
}
