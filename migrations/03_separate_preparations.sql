-- Migration to separate Raw Materials and Preparations (Split Catalog)
-- AS REQUESTED: 4 Distinct tables strategy.

-- 1. Drop dependencies first (Cascade will handle it, but being explicit is safer for understanding)
drop table if exists public.dish_ingredients cascade;
drop table if exists public.inventory_movements cascade;
drop table if exists public.inventory_stock cascade;
drop table if exists public.catalog_items cascade;

-- 2. RAW MATERIALS (Materie Prime) - Strict units, purchase focus
create table public.raw_materials (
  id uuid default uuid_generate_v4() primary key,
  code text unique, -- Barcode or supplier code
  name text not null,
  category text default 'generic', -- Dairy, Meat, Veg
  unit text not null, -- kg, lt, pz
  min_stock_alert float default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 3. PREPARATIONS (Preparazioni) - Kitchen logic, maybe looser units
create table public.preparations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  station_id uuid references public.areas(id), -- Station responsible (e.g., 'Salsas')
  storage_unit text, -- 'Vaschetta', 'Litro', 'Porzione'
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 4. INVENTORY: RAW (Inventario Materie Prime)
create table public.inventory_raw (
  id uuid default uuid_generate_v4() primary key,
  area_id uuid references public.areas(id) not null,
  material_id uuid references public.raw_materials(id) not null,
  quantity float default 0 check (quantity >= 0),
  last_updated timestamptz default now(),
  unique(area_id, material_id)
);

-- 5. INVENTORY: PREPARATIONS (Inventario Preparazioni)
create table public.inventory_preparations (
  id uuid default uuid_generate_v4() primary key,
  area_id uuid references public.areas(id) not null,
  preparation_id uuid references public.preparations(id) not null,
  quantity float default 0 check (quantity >= 0), -- e.g., 3 Vaschette
  last_updated timestamptz default now(),
  unique(area_id, preparation_id)
);

-- 6. DISH INGREDIENTS (Polymorphic: Can use Raw OR Prep)
create table public.dish_ingredients (
  id uuid default uuid_generate_v4() primary key,
  dish_id uuid references public.dishes(id) on delete cascade not null,
  
  -- Link to ONE of the two types
  raw_material_id uuid references public.raw_materials(id),
  preparation_id uuid references public.preparations(id),
  
  quantity float not null,
  unit text, -- 'g', 'ml', 'pz' (might differ from stock unit)
  
  -- Constraint: Must be one or the other, not both, not neither
  check (
    (raw_material_id is not null and preparation_id is null) or
    (raw_material_id is null and preparation_id is not null)
  ),
  
  created_at timestamptz default now()
);

-- RLS Policies
alter table public.raw_materials enable row level security;
alter table public.preparations enable row level security;
alter table public.inventory_raw enable row level security;
alter table public.inventory_preparations enable row level security;
alter table public.dish_ingredients enable row level security;

-- Simple read/write policies for authenticated
create policy "Allow auth read raw" on public.raw_materials for select using (auth.role() = 'authenticated');
create policy "Allow auth write raw" on public.raw_materials for all using (auth.role() = 'authenticated');

create policy "Allow auth read preps" on public.preparations for select using (auth.role() = 'authenticated');
create policy "Allow auth write preps" on public.preparations for all using (auth.role() = 'authenticated');

create policy "Allow auth read inv_raw" on public.inventory_raw for select using (auth.role() = 'authenticated');
create policy "Allow auth write inv_raw" on public.inventory_raw for all using (auth.role() = 'authenticated');

create policy "Allow auth read inv_preps" on public.inventory_preparations for select using (auth.role() = 'authenticated');
create policy "Allow auth write inv_preps" on public.inventory_preparations for all using (auth.role() = 'authenticated');

create policy "Allow auth read dish_ing" on public.dish_ingredients for select using (auth.role() = 'authenticated');
create policy "Allow auth write dish_ing" on public.dish_ingredients for all using (auth.role() = 'authenticated');
