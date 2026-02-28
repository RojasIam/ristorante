-- Add min_stock column to inventory_preparations to support the "Traffic Light" status
-- Use a default of 5 for now so we can see the effect (Red/Yellow) immediately if quantity is 0.

ALTER TABLE public.inventory_preparations
ADD COLUMN min_stock numeric default 5;

-- Update existing records to have a default min_stock if null
UPDATE public.inventory_preparations
SET min_stock = 5
WHERE min_stock IS NULL;
