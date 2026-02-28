-- 19_link_subareas.sql
-- Links subareas (Primi, Secondi, etc.) to the main 'Cocina' department.

BEGIN;

DO $$
DECLARE
    v_cocina_id UUID;
    v_sala_id UUID;
BEGIN
    -- 1. Get Cocina ID (Ensure it exists)
    SELECT id INTO v_cocina_id FROM public.areas WHERE slug = 'cocina';
    IF v_cocina_id IS NULL THEN
        INSERT INTO public.areas (name, slug, type) VALUES ('Cocina', 'cocina', 'department') RETURNING id INTO v_cocina_id;
    END IF;

    -- 2. Link Kitchen Subareas
    UPDATE public.areas 
    SET parent_id = v_cocina_id, type = 'production_line'
    WHERE slug IN ('primi', 'secondi', 'dolci', 'antipasto', 'salumeria', 'antipasti');

    -- 3. Get Sala ID
    SELECT id INTO v_sala_id FROM public.areas WHERE slug = 'sala';
    IF v_sala_id IS NULL THEN
        INSERT INTO public.areas (name, slug, type) VALUES ('Sala', 'sala', 'department') RETURNING id INTO v_sala_id;
    END IF;

    -- 4. Clean up any 'Antipasti' duplicate if 'Antipasto' exists (Optional, mostly for hygiene)
    -- Checking if both exist and merge parent_id is enough for now. The UI handles name display.

END $$;

COMMIT;
