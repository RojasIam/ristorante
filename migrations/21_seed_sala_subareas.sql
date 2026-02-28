
-- 1. Ensure 'Sala' Department exists
INSERT INTO areas (name, slug, type) 
VALUES ('Sala', 'sala', 'department')
ON CONFLICT (slug) DO UPDATE SET type = 'department';

-- 2. Add 'Bar' and 'Locale' Sub-areas
-- We use a DO block to dynamically get the ID of 'Sala'
DO $$
DECLARE
    sala_id uuid;
BEGIN
    SELECT id INTO sala_id FROM areas WHERE slug = 'sala';

    -- Insert 'Bar' (only if not exists)
    INSERT INTO areas (name, slug, parent_id, type)
    VALUES ('Bar', 'bar', sala_id, 'station')
    ON CONFLICT (slug) DO NOTHING;

    -- Insert 'Locale' (only if not exists)
    INSERT INTO areas (name, slug, parent_id, type)
    VALUES ('Locale', 'locale', sala_id, 'station')
    ON CONFLICT (slug) DO NOTHING;

END $$;
