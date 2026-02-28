-- 23_create_daily_reservations.sql

-- Drop table if exists to keep migration clean
DROP TABLE IF EXISTS daily_reservations;

CREATE TABLE daily_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_date DATE NOT NULL,
    service_type TEXT NOT NULL CHECK (service_type IN ('P', 'C')), -- Pranzo, Cena
    cover_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure one record per service per day
    CONSTRAINT unique_daily_service UNIQUE (reservation_date, service_type)
);

-- Enable RLS
ALTER TABLE daily_reservations ENABLE ROW LEVEL SECURITY;

-- Policies for Authenticated Users (Read/Write)
CREATE POLICY "Allow authenticated to read reservations" ON daily_reservations
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated to upsert reservations" ON daily_reservations
    FOR ALL USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_daily_reservations_modtime
    BEFORE UPDATE ON daily_reservations
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
