-- 13_update_user_roles.sql
-- Add 'cameriere' and 'cuoco' to user_role ENUM
-- Note: PostgreSQL usually requires ALTER TYPE ... ADD VALUE

-- Wrap in transaction block to be safe
BEGIN;

-- Add 'cameriere' if not exists
DO $$
BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'cameriere';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add 'cuoco' if not exists
DO $$
BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'cuoco';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

COMMIT;
