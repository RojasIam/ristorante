-- Enable delete for authenticated users on dishes table
create policy "Allow authenticated delete dishes" on public.dishes for delete using (auth.role() = 'authenticated');
