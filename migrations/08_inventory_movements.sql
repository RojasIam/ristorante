-- Migration to add Barcodes, Movements, and Batches for Raw Materials
-- Enhanced for GARS SYSTEM 2026

-- 1. Add 'barcode' to RAW MATERIALS
-- This allows assigning a master barcode to the product
alter table public.raw_materials
add column if not exists barcode text unique; 

-- 2. Create BARCODE ALIASES table 
-- Allows multiple barcodes (different brands/sizes) to point to ONE master product.
create table if not exists public.raw_material_aliases (
  id uuid default uuid_generate_v4() primary key,
  material_id uuid references public.raw_materials(id) on delete cascade not null,
  barcode text unique not null,
  quantity_in_unit float default 1, -- e.g. 5 for a 5kg bag, so 1 scan adds 5 units
  description text, -- e.g. "Saco 5kg Gallo"
  created_at timestamptz default now()
);

-- 3. Create INVENTORY BATCHES (Lotes)
-- Tracks expiration dates and entry dates for specific quantities
create table if not exists public.inventory_batches (
  id uuid default uuid_generate_v4() primary key,
  inventory_id uuid references public.inventory_raw(id) on delete cascade not null, -- Links to the inventory line
  batch_code text, -- Internal or Supplier Lot Code
  quantity_remaining float not null check (quantity_remaining >= 0),
  expiration_date date,
  entry_date timestamptz default now(),
  created_at timestamptz default now(),
  supplier text -- Added for tracking the provider
);

-- 4. Create INVENTORY MOVEMENTS (Historial)
-- Replacing the dropped table with a robust one
create table if not exists public.inventory_movements (
  id uuid default uuid_generate_v4() primary key,
  inventory_id uuid references public.inventory_raw(id) on delete cascade not null, -- What item?
  
  change_amount float not null, -- +10, -5, etc.
  current_stock_after float not null, -- Snapshot of total stock after move
  
  movement_type text not null check (movement_type in ('IN', 'OUT', 'WASTE', 'AUDIT', 'INITIAL')),
  reason text, -- "Compra", "Receta Boloñesa", "Caducado"
  
  batch_id uuid references public.inventory_batches(id), -- Optional: If move is related to a specific batch
  
  operator_id uuid references auth.users(id), -- WHO did it?
  created_at timestamptz default now()
);

-- 5. RLS Policies
alter table public.inventory_batches enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.raw_material_aliases enable row level security;

create policy "Allow auth read batches" on public.inventory_batches for select using (auth.role() = 'authenticated');
create policy "Allow auth write batches" on public.inventory_batches for all using (auth.role() = 'authenticated');

create policy "Allow auth read movements" on public.inventory_movements for select using (auth.role() = 'authenticated');
create policy "Allow auth write movements" on public.inventory_movements for all using (auth.role() = 'authenticated');

create policy "Allow auth read aliases" on public.raw_material_aliases for select using (auth.role() = 'authenticated');
create policy "Allow auth write aliases" on public.raw_material_aliases for all using (auth.role() = 'authenticated');

-- Fallback safely add column if table already existed
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name='inventory_batches' and column_name='supplier') then 
    alter table public.inventory_batches add column supplier text; 
  end if; 
end $$;
