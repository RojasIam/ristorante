-- 14_check_users_content.sql
-- Check if 'users' table exists and its row count

DO $$
DECLARE
    users_exists BOOLEAN;
    users_count INTEGER;
BEGIN
    SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') INTO users_exists;
    
    IF users_exists THEN
        EXECUTE 'SELECT count(*) FROM public.users' INTO users_count;
        RAISE NOTICE 'Table public.users exists with % rows.', users_count;
    ELSE
        RAISE NOTICE 'Table public.users does not exist.';
    END IF;
END $$;
