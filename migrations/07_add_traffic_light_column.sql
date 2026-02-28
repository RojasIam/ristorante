-- Enable traffic light status safely
-- 1. Create ENUM type if not exists
DO $$ BEGIN
    CREATE TYPE public.traffic_light_status AS ENUM ('green', 'yellow', 'red');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add column to inventory_preparations if not exists
ALTER TABLE public.inventory_preparations
ADD COLUMN IF NOT EXISTS status_traffic_light public.traffic_light_status DEFAULT 'green';

-- 3. Reset existing null values to 'green'
UPDATE public.inventory_preparations
SET status_traffic_light = 'green'
WHERE status_traffic_light IS NULL;
