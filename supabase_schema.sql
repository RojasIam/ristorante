-- GARS System Database Scheme
-- ... (Parts 1 and 2 same as before: Extensions and ENUMs) ...

-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. ENUMS for Consistency and Data Integrity
do $$ begin
    create type user_role as enum ('super_admin', 'admin', 'head_chef', 'maitre', 'staff'); 
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type area_type as enum ('department', 'production_line', 'service_point', 'storage');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type assignment_role as enum ('manager', 'contributor', 'viewer');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type item_category as enum ('raw_material', 'prepped', 'beverage', 'supply', 'equipment');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type stock_movement_type as enum ('purchase', 'consumption', 'transfer', 'waste', 'correction', 'production');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type dish_status as enum ('active', 'inactive', 'seasonal', 'out_of_stock'); 
exception
    when duplicate_object then null;
end $$;


-- 3. PROFILES (Extending Supabase Auth)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  first_name text,
  last_name text,
  global_role user_role default 'staff', 
  avatar_url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ensure columns exist if table was already created
do $$ 
begin
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'first_name') then
        alter table public.profiles add column first_name text;
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'last_name') then
        alter table public.profiles add column last_name text;
    end if;
end $$;

-- Trigger logic needs to be safe if it already exists
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (new.id, new.email, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name')
  on conflict (id) do update set email = excluded.email; -- Safe update if exists
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists to recreate it cleanly
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- BACKFILL PROFILES from existing AUTH.USERS
-- This is critical for your existing users (admin@garsystem.com, etc.)
insert into public.profiles (id, email, first_name, last_name)
select 
  id, 
  email, 
  raw_user_meta_data->>'first_name', 
  raw_user_meta_data->>'last_name'
from auth.users
on conflict (id) do nothing;


-- 4. AREAS HIERARCHY
create table if not exists public.areas (
  id uuid default uuid_generate_v4() primary key,
  name text not null, 
  slug text unique not null, 
  type area_type not null,
  parent_id uuid references public.areas(id), 
  description text,
  is_active boolean default true,
  created_at timestamptz default now()
);
create index if not exists idx_areas_parent on public.areas(parent_id);


-- 5. STAFF ASSIGNMENTS
create table if not exists public.area_assignments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  area_id uuid references public.areas(id) not null,
  role_in_area assignment_role default 'viewer',
  assigned_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  unique(user_id, area_id)
);


-- 6. CATALOG
create table if not exists public.catalog_items (
  id uuid default uuid_generate_v4() primary key,
  code text unique,
  name text not null,
  category item_category not null,
  unit text not null,
  min_stock_alert float default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);


-- 7. LIVE INVENTORY
create table if not exists public.inventory_stock (
  id uuid default uuid_generate_v4() primary key,
  area_id uuid references public.areas(id) not null,
  item_id uuid references public.catalog_items(id) not null,
  quantity float default 0 check (quantity >= 0),
  last_updated timestamptz default now(),
  unique(area_id, item_id)
);


-- 8. INVENTORY MOVEMENTS
create table if not exists public.inventory_movements (
  id uuid default uuid_generate_v4() primary key,
  item_id uuid references public.catalog_items(id) not null,
  from_area_id uuid references public.areas(id), 
  to_area_id uuid references public.areas(id), 
  quantity float not null,
  type stock_movement_type not null,
  performed_by uuid references public.profiles(id) not null,
  batch_id text, 
  notes text,
  created_at timestamptz default now()
);


-- 9. WORK SHIFTS
create table if not exists public.work_shifts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  area_id uuid references public.areas(id) not null, 
  start_time timestamptz not null,
  end_time timestamptz not null,
  assigned_by uuid references public.profiles(id) not null,
  status text default 'scheduled' check (status in ('scheduled', 'confirmed', 'completed', 'absent', 'cancelled')),
  notes text,
  created_at timestamptz default now()
);

-- Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.areas enable row level security;
alter table public.area_assignments enable row level security;
alter table public.catalog_items enable row level security;
alter table public.inventory_stock enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.work_shifts enable row level security;

-- Basic READ policy
drop policy if exists "Allow logged-in read" on public.profiles;
create policy "Allow logged-in read" on public.profiles for select using (auth.role() = 'authenticated');

drop policy if exists "Allow logged-in read" on public.areas;
create policy "Allow logged-in read" on public.areas for select using (auth.role() = 'authenticated');
