-- 24_ensure_editor_role.sql
-- Force 'editor' into the enum just in case it is missing.

BEGIN;

DO $$
BEGIN
    ALTER TYPE public.area_role ADD VALUE 'editor';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

COMMIT;
