-- Migration to fix incomplete profiles table
-- Run this if you encounter "first_name does not exist" errors

do $$ 
begin
    -- Add first_name if missing
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'first_name') then
        alter table public.profiles add column first_name text;
    end if;

    -- Add last_name if missing
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'last_name') then
        alter table public.profiles add column last_name text;
    end if;
end $$;
