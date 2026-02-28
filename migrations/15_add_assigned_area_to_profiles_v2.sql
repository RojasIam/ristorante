-- 15_add_assigned_area_to_profiles_v2.sql

BEGIN;

-- 1. Create Area if not exists (One by one to be safe)
DO $$
BEGIN
    INSERT INTO public.areas (name, slug, type) VALUES ('Sala', 'sala', 'service_point') ON CONFLICT (slug) DO NOTHING;
    INSERT INTO public.areas (name, slug, type) VALUES ('Salumeria', 'salumeria', 'production_line') ON CONFLICT (slug) DO NOTHING;
    INSERT INTO public.areas (name, slug, type) VALUES ('Primi', 'primi', 'production_line') ON CONFLICT (slug) DO NOTHING;
    INSERT INTO public.areas (name, slug, type) VALUES ('Secondi', 'secondi', 'production_line') ON CONFLICT (slug) DO NOTHING;
    INSERT INTO public.areas (name, slug, type) VALUES ('Dolci', 'dolci', 'production_line') ON CONFLICT (slug) DO NOTHING;
    INSERT INTO public.areas (name, slug, type) VALUES ('Antipasto', 'antipasto', 'production_line') ON CONFLICT (slug) DO NOTHING;
END $$;

-- 2. Add Column to Profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS assigned_area_id UUID REFERENCES public.areas(id);

COMMIT;
