-- Allow all authenticated users to read area assignments
-- This is necessary for the Staff table to show correctly to everyone
DROP POLICY IF EXISTS "Allow logged-in read assignments" ON public.area_assignments;
CREATE POLICY "Allow logged-in read assignments" ON public.area_assignments 
  FOR SELECT 
  USING (auth.role() = 'authenticated');
