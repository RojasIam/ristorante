-- MERGE ANTIPASTO INTO ANTIPASTI AND CLEANUP NON-KITCHEN AREAS FOR KITCHEN FLOW

BEGIN;

-- 1. Identify IDs
DO $$
DECLARE
    v_target_id UUID;
    v_old_id UUID;
    v_cocina_id UUID;
BEGIN
    SELECT id INTO v_target_id FROM public.areas WHERE slug = 'antipasti';
    SELECT id INTO v_old_id FROM public.areas WHERE slug = 'antipasto';
    SELECT id INTO v_cocina_id FROM public.areas WHERE slug = 'cocina';

    IF v_target_id IS NOT NULL AND v_old_id IS NOT NULL THEN
        -- Move preparations
        UPDATE public.preparations SET station_id = v_target_id WHERE station_id = v_old_id;
        
        -- Move dishes
        UPDATE public.dishes SET area_id = v_target_id WHERE area_id = v_old_id;
        
        -- Move inventory (careful with duplicates)
        -- Raw items
        INSERT INTO public.inventory_raw (area_id, material_id, quantity)
        SELECT v_target_id, material_id, quantity FROM public.inventory_raw WHERE area_id = v_old_id
        ON CONFLICT (area_id, material_id) DO UPDATE SET quantity = public.inventory_raw.quantity + EXCLUDED.quantity;
        DELETE FROM public.inventory_raw WHERE area_id = v_old_id;

        -- Prepped items
        INSERT INTO public.inventory_preparations (area_id, preparation_id, quantity)
        SELECT v_target_id, preparation_id, quantity FROM public.inventory_preparations WHERE area_id = v_old_id
        ON CONFLICT (area_id, preparation_id) DO UPDATE SET quantity = public.inventory_preparations.quantity + EXCLUDED.quantity;
        DELETE FROM public.inventory_preparations WHERE area_id = v_old_id;

        -- Move assignments
        UPDATE public.area_assignments SET area_id = v_target_id WHERE area_id = v_old_id
        ON CONFLICT (user_id, area_id) DO NOTHING;
        DELETE FROM public.area_assignments WHERE area_id = v_old_id;

        -- Finally delete the old area
        DELETE FROM public.areas WHERE id = v_old_id;
    END IF;

    -- Ensure all kitchen areas have Cocina as parent
    UPDATE public.areas 
    SET parent_id = v_cocina_id 
    WHERE slug IN ('salumeria', 'primi', 'secondi', 'dolci', 'antipasti')
    AND v_cocina_id IS NOT NULL;

END $$;

COMMIT;
