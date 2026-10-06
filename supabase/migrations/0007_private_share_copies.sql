-- Final-review fix C1 (2026-10-06): 0006's "generations: read shared" policy
-- granted anonymous SELECT on every shared object, so anyone holding the
-- public anon key could LIST the bucket and download every shared track
-- without its link — sharing became publishing.
--
-- New design, still without any service-role key at runtime:
--   * the private "generations" bucket is owner-only again (policy dropped);
--   * a public "shared" bucket holds one copy per live share, named
--     <share_token>.<ext>. It has NO anonymous SELECT policy, so listing it
--     returns nothing; its public URL works only for whoever already holds the
--     96-bit token (the same capability as the /t/<token> page);
--   * only the owner of a live share may write, read or remove its copy; the
--     app removes the copy before clearing the token (unshare / delete).
-- get_shared_track no longer returns the job id or private storage path.

drop policy "generations: read shared" on storage.objects;
drop function public.is_shared_generation_object(text);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shared', 'shared', true, 20971520, array['audio/mpeg', 'audio/wav'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Does the caller own the job whose share token names this object
-- ("<token>.<ext>")? p_live additionally requires the share to be usable.
create function public.owns_share_object(p_name text, p_live boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.generation_jobs j
     where j.user_id = auth.uid()
       and j.share_token is not null
       and j.share_token = split_part(p_name, '.', 1)
       and (not p_live or (j.status = 'completed' and j.deleted_at is null))
  );
$$;

revoke execute on function public.owns_share_object(text, boolean) from public, anon;
grant execute on function public.owns_share_object(text, boolean) to authenticated;

create policy "shared: owner read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'shared' and public.owns_share_object(name, false));

create policy "shared: owner publish"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'shared' and public.owns_share_object(name, true));

create policy "shared: owner remove"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'shared' and public.owns_share_object(name, false));

-- By-token read of one shared track — no internal ids in the result.
drop function public.get_shared_track(text);

create function public.get_shared_track(p_token text)
returns table (
  title text,
  rhythm_name text,
  rhythm_slug text,
  duration_seconds numeric,
  format text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select j.title, r.name, r.slug, a.duration_seconds, a.format, j.created_at
    from public.generation_jobs j
    join public.audio_assets a on a.generation_job_id = j.id
    left join public.rhythms r on r.id = j.rhythm_id
   where p_token is not null
     and j.share_token = p_token
     and j.status = 'completed'
     and j.deleted_at is null;
$$;

revoke execute on function public.get_shared_track(text) from public;
grant execute on function public.get_shared_track(text) to anon, authenticated;
