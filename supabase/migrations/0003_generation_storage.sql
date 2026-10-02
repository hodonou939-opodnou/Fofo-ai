insert into storage.buckets (id, name, public)
values ('generations', 'generations', false)
on conflict (id) do nothing;

create policy "generations: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'generations'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "generations: owner read"
  on storage.objects for select
  using (
    bucket_id = 'generations'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

alter publication supabase_realtime add table generation_jobs;
