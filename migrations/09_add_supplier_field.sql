-- Migration to safely add 'supplier' column to inventory_batches
-- Run this to fix the missing field without re-creating tables

do $$ 
begin 
  -- Check if column exists, if not add it
  if not exists (select 1 from information_schema.columns where table_name='inventory_batches' and column_name='supplier') then 
    alter table public.inventory_batches add column supplier text; 
  end if; 
end $$;
