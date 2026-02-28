-- 11_add_manual_recipe_fields.sql

-- Add text columns for manual entry of ingredients and recipe
-- This allows skipping the complex relational logic for now as requested.

alter table public.dishes 
add column if not exists ingredients_text text, -- "200g Pasta\n2 Uova\n..."
add column if not exists allergens_text text; -- "Gluten, Eggs, Dairy"

-- Note: 'preparation_method' already exists from migration 01.
