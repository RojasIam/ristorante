-- 25_create_individual_reservations.sql

CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    service_type TEXT NOT NULL CHECK (service_type IN ('P', 'C')), -- Pranzo, Cena
    cover_count INTEGER NOT NULL DEFAULT 1 CHECK (cover_count > 0),
    customer_phone TEXT,
    notes TEXT,
    allergies TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    review_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage reservations
CREATE POLICY "Allow authenticated to manage reservations" ON public.reservations
    FOR ALL USING (auth.role() = 'authenticated');

-- Trigger function to automatically update daily_reservations (the totals) when a reservation changes
CREATE OR REPLACE FUNCTION update_daily_reservations_total()
RETURNS TRIGGER AS $$
BEGIN
    -- If it's an insert or update that affects covers or service_type/date, and status is not cancelled
    IF (TG_OP = 'INSERT' AND NEW.status != 'cancelled') OR 
       (TG_OP = 'UPDATE' AND (NEW.status != 'cancelled' OR OLD.status != 'cancelled')) OR
       (TG_OP = 'DELETE') THEN
        
        -- Recalculate and upsert the total for the affected row(s)
        
        -- Handle OLD record if it was an update changing dates or a delete/cancellation
        IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
            INSERT INTO daily_reservations (reservation_date, service_type, cover_count)
            VALUES (
                OLD.reservation_date, 
                OLD.service_type, 
                COALESCE((SELECT SUM(cover_count) FROM reservations WHERE reservation_date = OLD.reservation_date AND service_type = OLD.service_type AND status != 'cancelled'), 0)
            )
            ON CONFLICT (reservation_date, service_type) 
            DO UPDATE SET cover_count = EXCLUDED.cover_count;
        END IF;

        -- Handle NEW record if it's an insert or update that isn't cancelled
        IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status != 'cancelled')) THEN
            INSERT INTO daily_reservations (reservation_date, service_type, cover_count)
            VALUES (
                NEW.reservation_date, 
                NEW.service_type, 
                COALESCE((SELECT SUM(cover_count) FROM reservations WHERE reservation_date = NEW.reservation_date AND service_type = NEW.service_type AND status != 'cancelled'), 0)
            )
            ON CONFLICT (reservation_date, service_type) 
            DO UPDATE SET cover_count = EXCLUDED.cover_count;
        END IF;

    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger
DROP TRIGGER IF EXISTS trigger_sync_reservations_total ON public.reservations;
CREATE TRIGGER trigger_sync_reservations_total
    AFTER INSERT OR UPDATE OR DELETE ON public.reservations
    FOR EACH ROW EXECUTE PROCEDURE update_daily_reservations_total();

-- Ensure trigger for updated_at in reservations
do $$ begin
    create trigger update_reservations_modtime
        before update on public.reservations
        for each row execute procedure public.update_modified_column();
exception
    when undefined_function then
        null; -- If the update_modified_column function does not exist, ignore
end $$;
