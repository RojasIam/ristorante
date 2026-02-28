-- Enable delete for authenticated users on menus table
create policy "Allow authenticated delete menus" on public.menus for delete using (auth.role() = 'authenticated');
