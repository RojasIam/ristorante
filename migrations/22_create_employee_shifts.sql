
-- 22_create_employee_shifts.sql

-- Drop table if exists to ensure clean state during development
DROP TABLE IF EXISTS employee_shifts;

-- Create the table for tracking shifts
CREATE TABLE employee_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    shift_type TEXT NOT NULL CHECK (shift_type IN ('P', 'C')), -- Pranzo, Cena
    status TEXT NOT NULL CHECK (status IN ('working', 'off')), -- 'empty' means no record
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure user cannot have duplicate entry for same shift slot
    CONSTRAINT unique_user_shift UNIQUE (user_id, shift_date, shift_type)
);

-- Enable RLS
ALTER TABLE employee_shifts ENABLE ROW LEVEL SECURITY;

-- Policies for Authenticated Users (Everyone can see, only managers can edit - simplified for now: allow all auth to read/write for demo speed, refine later)
CREATE POLICY "Allow authenticated to read shifts" ON employee_shifts
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated to upsert shifts" ON employee_shifts
    FOR ALL USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_employee_shifts_modtime
    BEFORE UPDATE ON employee_shifts
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
