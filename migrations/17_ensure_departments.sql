-- 17_ensure_departments.sql
-- Force 'Cocina' and 'Sala' to be departments so they show up in the dropdown.

BEGIN;

-- 1. Upsert Cocina (Kitchen) -> Department
INSERT INTO public.areas (name, slug, type) 
VALUES ('Cocina', 'cocina', 'department') 
ON CONFLICT (slug) DO UPDATE SET type = 'department';

-- 2. Upsert Sala (Dining Room) -> Department
INSERT INTO public.areas (name, slug, type) 
VALUES ('Sala', 'sala', 'department') 
ON CONFLICT (slug) DO UPDATE SET type = 'department';

-- 3. Ensure RLS allows reading
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Areas" ON public.areas;
CREATE POLICY "Public Read Areas" ON public.areas FOR SELECT USING (true); 
-- (Temporarily allow public read to debug, or restricting to authenticated is also fine)
-- Let's stick to authenticated but ensure it exists
DROP POLICY IF EXISTS "Allow logged-in read" ON public.areas;
CREATE POLICY "Allow logged-in read" ON public.areas FOR SELECT USING (auth.role() = 'authenticated');


COMMIT;
