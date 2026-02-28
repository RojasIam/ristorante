-- SEED SCRIPT: POPULATE OTHER KITCHEN STATIONS (Salumeria, Secondi, Dolci, Antipasti)
-- This ensures no station is empty for the demo.

do $$
declare
    v_salumeria_id uuid;
    v_secondi_id uuid;
    v_dolci_id uuid;
    v_antipasti_id uuid;
begin
    -- 1. Ensure Stations Exist and Get IDs
    
    -- Salumeria
    select id into v_salumeria_id from public.areas where lower(slug) = 'salumeria' limit 1;
    if v_salumeria_id is null then
        insert into public.areas (name, slug, type) values ('Salumeria', 'salumeria', 'production_line') returning id into v_salumeria_id;
    end if;

    -- Secondi
    select id into v_secondi_id from public.areas where lower(slug) = 'secondi' limit 1;
    if v_secondi_id is null then
        insert into public.areas (name, slug, type) values ('Secondi', 'secondi', 'production_line') returning id into v_secondi_id;
    end if;

    -- Dolci
    select id into v_dolci_id from public.areas where lower(slug) = 'dolci' limit 1;
    if v_dolci_id is null then
        insert into public.areas (name, slug, type) values ('Dolci', 'dolci', 'production_line') returning id into v_dolci_id;
    end if;

    -- Antipasti
    select id into v_antipasti_id from public.areas where lower(slug) = 'antipasti' limit 1;
    if v_antipasti_id is null then
        insert into public.areas (name, slug, type) values ('Antipasti', 'antipasti', 'production_line') returning id into v_antipasti_id;
    end if;


    -- 2. Insert Sample Preparations (4 per station)

    -- Salumeria (Cold Cuts & Cheese)
    insert into public.preparations (name, station_id, storage_unit) values
    ('Tagliere Misto Grande', v_salumeria_id, 'Pezzo'),
    ('Porzione Prosciutto Crudo', v_salumeria_id, 'Porzione'),
    ('Crema di Formaggi', v_salumeria_id, 'Vaschetta'),
    ('Giardiniera Fatta in Casa', v_salumeria_id, 'Vasetto');

    -- Secondi (Main Meat/Fish Courses)
    insert into public.preparations (name, station_id, storage_unit) values
    ('Base Brasato al Barolo', v_secondi_id, 'Litro'),
    ('Polpette al Sugo (Pre-cotte)', v_secondi_id, 'Pezzo'),
    ('Filetto Marinato', v_secondi_id, 'Pezzo'),
    ('Riduzione di Vino Rosso', v_secondi_id, 'Biberon');

    -- Dolci (Desserts)
    insert into public.preparations (name, station_id, storage_unit) values
    ('Crema Tiramisù', v_dolci_id, 'Vaschetta'),
    ('Base Panna Cotta', v_dolci_id, 'Litro'),
    ('Crumble alle Nocciole', v_dolci_id, 'Vaschetta'),
    ('Salsa Frutti di Bosco', v_dolci_id, 'Biberon');

    -- Antipasti (Starters)
    insert into public.preparations (name, station_id, storage_unit) values
    ('Insalata di Mare', v_antipasti_id, 'Vaschetta'),
    ('Caponata Siciliana', v_antipasti_id, 'Vaschetta'),
    ('Bruschette Pomodoro Mix', v_antipasti_id, 'Vaschetta'),
    ('Patè di Fegatini', v_antipasti_id, 'Vaschetta');


    -- 3. Auto-initialize Inventory (0 stock) for all inserted items
    
    -- Salumeria Inventory
    insert into public.inventory_preparations (area_id, preparation_id, quantity)
    select v_salumeria_id, id, 0 from public.preparations where station_id = v_salumeria_id
    on conflict (area_id, preparation_id) do nothing;

    -- Secondi Inventory
    insert into public.inventory_preparations (area_id, preparation_id, quantity)
    select v_secondi_id, id, 0 from public.preparations where station_id = v_secondi_id
    on conflict (area_id, preparation_id) do nothing;

    -- Dolci Inventory
    insert into public.inventory_preparations (area_id, preparation_id, quantity)
    select v_dolci_id, id, 0 from public.preparations where station_id = v_dolci_id
    on conflict (area_id, preparation_id) do nothing;

    -- Antipasti Inventory
    insert into public.inventory_preparations (area_id, preparation_id, quantity)
    select v_antipasti_id, id, 0 from public.preparations where station_id = v_antipasti_id
    on conflict (area_id, preparation_id) do nothing;

end $$;
