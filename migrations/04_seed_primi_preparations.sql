-- SEED SCRIPT: POPULATE PRIMI PREPARATIONS (Based on legacy script)
-- Designed for GARS System (uses UUIDs and new 'preparations' table)

do $$
declare
    v_station_id uuid;
begin
    -- 1. Find the Station ID for 'Primi' (Case insensitive search)
    select id into v_station_id from public.areas where lower(slug) = 'primi' or lower(name) = 'primi' limit 1;

    -- If station doesn't exist, Create it momentarily (Safety net)
    if v_station_id is null then
        insert into public.areas (name, slug, type) values ('Primi', 'primi', 'production_line') returning id into v_station_id;
    end if;

    -- 2. Insert Preparations linked to this Station
    -- Using common storage units based on item type guess (can be updated later)
    insert into public.preparations (name, station_id, storage_unit) values
    ('Brodo', v_station_id, 'Litro'),
    ('Burro Fuso', v_station_id, 'Litro'),
    ('Vellutata di Zucca', v_station_id, 'Litro'),
    ('Canederli Spinaci', v_station_id, 'Pezzo'),
    ('Canederli Formaggio', v_station_id, 'Pezzo'),
    ('Zucca X Decorazioni', v_station_id, 'Vaschetta'),
    ('Crumble di biscotti', v_station_id, 'Vaschetta'),
    ('Zuppa di verza', v_station_id, 'Litro'),
    ('Bandiere Speck', v_station_id, 'Pezzo'),
    ('Chips di Formaggio', v_station_id, 'Pezzo'),
    ('Ravioli Pusteresi', v_station_id, 'Pezzo'),
    ('Cavolo Rosso', v_station_id, 'Vaschetta'),
    ('Cavolo Bianco', v_station_id, 'Vaschetta'),
    ('Grana Macinata', v_station_id, 'Vaschetta'),
    ('Ravioli Mele Speck', v_station_id, 'Pezzo'),
    ('Gorgonzola', v_station_id, 'Vaschetta'),
    ('Speck tagliato', v_station_id, 'Vaschetta'),
    ('Cipolla Macinata', v_station_id, 'Vaschetta'),
    ('Maltagliati Cacao', v_station_id, 'Porzione'),
    ('Spazle', v_station_id, 'Porzione'),
    ('Ragu di cervo', v_station_id, 'Litro'),
    ('Riso', v_station_id, 'Kg'), -- Pre-cooked rice maybe?
    ('Speck Cotto tagliato', v_station_id, 'Vaschetta'),
    ('Base Risotto Zucca', v_station_id, 'Litro'),
    ('Burro a Cubetti', v_station_id, 'Pezzo'),
    ('Mandorle', v_station_id, 'Vaschetta'),
    ('Riso Lagrien', v_station_id, 'Kg'),
    ('Mirtilli X Pappardella', v_station_id, 'Vaschetta'),
    ('Pappardella', v_station_id, 'Porzione'),
    ('Porcini', v_station_id, 'Vaschetta'),
    ('Crostini Segale', v_station_id, 'Vaschetta');

    -- 3. Auto-initialize Inventory for these items (Optional but helpful)
    -- This makes them appear in the Inventory Manager immediately with 0 stock
    insert into public.inventory_preparations (area_id, preparation_id, quantity)
    select v_station_id, id, 0
    from public.preparations
    where station_id = v_station_id
    on conflict (area_id, preparation_id) do nothing;

end $$;
