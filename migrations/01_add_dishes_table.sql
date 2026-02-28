-- Additions to GARS System Database Scheme

do $$ begin
    create type dish_status as enum ('active', 'inactive', 'seasonal', 'out_of_stock'); 
exception
    when duplicate_object then null;
end $$;

-- 10. DISHES (Platos)
create table if not exists public.dishes (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text, -- For formatting, client-side rich text editors usually save HTML or Markdown here.
  preparation_method text, -- Detailed preparation instructions
  image_url text,
  status dish_status default 'active',
  station_id uuid references public.areas(id), -- Which kitchen station owns this dish (e.g., 'primi')
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 11. DISH INGREDIENTS (Recipe) - Linking Dishes to Catalog Items
create table if not exists public.dish_ingredients (
  id uuid default uuid_generate_v4() primary key,
  dish_id uuid references public.dishes(id) on delete cascade not null,
  item_id uuid references public.catalog_items(id) not null,
  quantity float not null, -- Quantity required for one portion
  unit text, -- Optional override if different from catalog unit
  created_at timestamptz default now()
);

-- 12. MENUS (Colecciones de Platos)
create table if not exists public.menus (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  image_url text,
  station_id uuid references public.areas(id), -- Optional: if a menu is specific to a station
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Linking Dishes to Menus (Many-to-Many maybe? or just simple list for now?)
-- For now, let's keep menus simple as requested (Title, Desc, Photo). 
-- If we need to link dishes later, we can add a junction table `menu_items`.

-- RLS for Dishes
alter table public.dishes enable row level security;
alter table public.dish_ingredients enable row level security;
alter table public.menus enable row level security;

-- Policies (Simplified for dev, usually restricting write to chefs/admins)
create policy "Allow logged-in read dishes" on public.dishes for select using (auth.role() = 'authenticated');
create policy "Allow chefs write dishes" on public.dishes for insert with check (auth.role() = 'authenticated'); -- Refine role check later
create policy "Allow chefs update dishes" on public.dishes for update using (auth.role() = 'authenticated');

create policy "Allow logged-in read ingredients" on public.dish_ingredients for select using (auth.role() = 'authenticated');
create policy "Allow chefs write ingredients" on public.dish_ingredients for insert with check (auth.role() = 'authenticated');

create policy "Allow logged-in read menus" on public.menus for select using (auth.role() = 'authenticated');
create policy "Allow chefs write menus" on public.menus for insert with check (auth.role() = 'authenticated');
create policy "Allow chefs update menus" on public.menus for update using (auth.role() = 'authenticated');
