-- Migration to add 'quantity_initial' to inventory_batches
-- Enhanced for GARS SYSTEM 2026

alter table public.inventory_batches
add column if not exists quantity_initial float;

-- Backfill existing data: Assume initial was at least what remains (best guess)
update public.inventory_batches
set quantity_initial = quantity_remaining
where quantity_initial is null;

-- Make it not null after backfill
alter table public.inventory_batches
alter column quantity_initial set not null;
