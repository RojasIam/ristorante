-- 16_fix_areas_hierarchy_and_clean_profiles.sql

BEGIN;

-- 1. Clean up the mistake: Remove the redundant column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS assigned_area_id;

-- 2. Ensure 'Cocina' (Kitchen) exists as a parent Department
INSERT INTO public.areas (name, slug, type) 
VALUES ('Cocina', 'cocina', 'department') 
ON CONFLICT (slug) DO NOTHING;

-- 3. Ensure 'Sala' exists as a Department (or Service Point, but broadly it's an Area)
-- Updating 'Sala' if it exists to be a department if needed, or just ensuring it exists.
INSERT INTO public.areas (name, slug, type) 
VALUES ('Sala', 'sala', 'department') 
ON CONFLICT (slug) DO UPDATE SET type = 'department';

-- 4. Structure the Hierarchy: Move specific lines under 'Cocina'
DO $$
DECLARE
    v_cocina_id UUID;
BEGIN
    SELECT id INTO v_cocina_id FROM public.areas WHERE slug = 'cocina';

    -- Update sub-areas to belong to Cocina
    UPDATE public.areas SET parent_id = v_cocina_id WHERE slug IN ('salumeria', 'primi', 'secondi', 'dolci', 'antipasto');
END $$;

COMMIT;
