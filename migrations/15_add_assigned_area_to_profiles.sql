-- 15_add_assigned_area_to_profiles.sql
-- Add 'assigned_area_id' to profiles to link staff to their primary work area

BEGIN;

-- 1. Ensure Areas Exist (Idempotent)
INSERT INTO public.areas (name, slug, type) VALUES
('Sala', 'sala', 'service_point'),
('Salumeria', 'salumeria', 'production_line'),
('Primi', 'primi', 'production_line'),
('Secondi', 'secondi', 'production_line'),
('Dolci', 'dolci', 'production_line'),
('Antipasto', 'antipasto', 'production_line')
ON CONFLICT (slug) DO NOTHING;

-- 2. Add Column to Profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS assigned_area_id UUID REFERENCES public.areas(id);

COMMIT;
