-- Replaces 0004's client write policies with server-checked state transitions.
--
-- 0004 let a signed-in user UPDATE every column of their own generation_jobs
-- rows (e.g. backdate created_at to defeat the hourly rate limit, rewrite
-- status or idempotency_key) and INSERT arbitrary audio_assets/usage_records
-- rows. The running app still never uses the service-role key, so the
-- generation worker (which runs with the requesting user's session) now goes
-- through the functions below. Each transition function checks that
-- auth.uid() owns the job and that the status transition is legal, and
-- raises otherwise. After this migration a signed-in user has no direct
-- UPDATE on generation_jobs and no direct INSERT on audio_assets or
-- usage_records.

drop policy "generation_jobs: owner update" on public.generation_jobs;
drop policy "audio_assets: owner insert" on public.audio_assets;
drop policy "usage_records: owner insert" on public.usage_records;

-- Hot path for the hourly rate-limit count and the library listing.
create index generation_jobs_user_id_created_at_idx
  on public.generation_jobs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Job creation, atomic per user: idempotency lookup -> rate limit -> insert.
-- SECURITY INVOKER: the insert goes through 0001's "owner insert" policy.
-- p_max_per_hour comes from MAX_GENERATIONS_PER_HOUR (rate-limit.ts), the
-- single named source of truth. A direct caller passing a huge limit gains
-- nothing: only the /api/generate route ever calls the provider.
-- ---------------------------------------------------------------------------
create function public.create_generation_job(
  p_rhythm_id uuid,
  p_prompt text,
  p_mood text,
  p_energy text,
  p_duration_seconds int,
  p_provider text,
  p_idempotency_key text,
  p_max_per_hour int
)
returns table (job_id uuid, created boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_recent_count int;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Serialize this user's job creations so the lookup, the count and the
  -- insert below behave as one step under concurrent requests.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  -- A retry of the same submission returns the existing job, even when the
  -- user has reached the rate limit since: a retry is not a new generation.
  select j.id into job_id
    from public.generation_jobs j
   where j.user_id = v_user_id
     and j.idempotency_key = p_idempotency_key;
  if found then
    created := false;
    return next;
    return;
  end if;

  select count(*) into v_recent_count
    from public.generation_jobs j
   where j.user_id = v_user_id
     and j.created_at >= now() - interval '1 hour';
  if v_recent_count >= p_max_per_hour then
    -- PT429: PostgREST answers HTTP 429 and passes this code through to the
    -- client; the route matches on it (RATE_LIMIT_EXCEEDED_CODE).
    raise exception 'generation rate limit exceeded' using errcode = 'PT429';
  end if;

  insert into public.generation_jobs (
    user_id, rhythm_id, prompt, mood, energy, duration_seconds,
    status, provider, idempotency_key
  )
  values (
    v_user_id, p_rhythm_id, p_prompt, p_mood, p_energy, p_duration_seconds,
    'queued', p_provider, p_idempotency_key
  )
  returning id into job_id;
  created := true;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Worker state transitions (SECURITY DEFINER: the caller has no direct write
-- access, so each function enforces ownership and the legal transition).
-- ---------------------------------------------------------------------------

-- queued -> processing
create function public.start_generation_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select j.status into v_status
    from public.generation_jobs j
   where j.id = p_job_id
     and j.user_id = auth.uid()
     for update;
  if not found then
    raise exception 'generation job % not found', p_job_id using errcode = 'P0002';
  end if;
  if v_status <> 'queued' then
    raise exception 'cannot start generation job % from status %', p_job_id, v_status
      using errcode = '55000';
  end if;

  update public.generation_jobs
     set status = 'processing',
         updated_at = now()
   where id = p_job_id;
end;
$$;

-- processing -> completed, atomically with its audio_assets and usage_records
-- rows, so a completed job can never exist without its stored asset.
create function public.complete_generation_job(
  p_job_id uuid,
  p_storage_path text,
  p_format text,
  p_duration_seconds numeric,
  p_sample_rate int,
  p_file_size_bytes bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
begin
  select j.status into v_status
    from public.generation_jobs j
   where j.id = p_job_id
     and j.user_id = v_user_id
     for update;
  if not found then
    raise exception 'generation job % not found', p_job_id using errcode = 'P0002';
  end if;
  if v_status <> 'processing' then
    raise exception 'cannot complete generation job % from status %', p_job_id, v_status
      using errcode = '55000';
  end if;
  if p_storage_path is null or not starts_with(p_storage_path, v_user_id::text || '/') then
    raise exception 'storage path must be inside the caller''s folder' using errcode = '42501';
  end if;

  insert into public.audio_assets (
    generation_job_id, storage_path, format, duration_seconds, sample_rate, file_size_bytes
  )
  values (
    p_job_id, p_storage_path, p_format, p_duration_seconds, p_sample_rate, p_file_size_bytes
  );

  update public.generation_jobs
     set status = 'completed',
         error_message = null,
         completed_at = now(),
         updated_at = now()
   where id = p_job_id;

  -- Phase 1 has no cost model yet: usage is recorded at 0, never caller-supplied.
  insert into public.usage_records (user_id, generation_job_id, estimated_cost)
  values (v_user_id, p_job_id, 0);
end;
$$;

-- queued|processing -> failed
create function public.fail_generation_job(p_job_id uuid, p_error_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select j.status into v_status
    from public.generation_jobs j
   where j.id = p_job_id
     and j.user_id = auth.uid()
     for update;
  if not found then
    raise exception 'generation job % not found', p_job_id using errcode = 'P0002';
  end if;
  if v_status not in ('queued', 'processing') then
    raise exception 'cannot fail generation job % from status %', p_job_id, v_status
      using errcode = '55000';
  end if;

  update public.generation_jobs
     set status = 'failed',
         error_message = p_error_message,
         updated_at = now()
   where id = p_job_id;
end;
$$;

-- Fails the caller's own queued|processing jobs not updated for longer than
-- p_stale_after_seconds (STALE_JOB_THRESHOLD_SECONDS, well above the route's
-- maxDuration): the after() worker is not durable, so a killed invocation
-- leaves no terminal write behind. Returns the number of jobs failed.
create function public.fail_stale_generation_jobs(p_stale_after_seconds int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_failed_count int;
begin
  update public.generation_jobs
     set status = 'failed',
         error_message = 'La génération a pris trop de temps et n''a pas pu aboutir. Réessaie.',
         updated_at = now()
   where user_id = auth.uid()
     and status in ('queued', 'processing')
     and updated_at < now() - make_interval(secs => p_stale_after_seconds);
  get diagnostics v_failed_count = row_count;
  return v_failed_count;
end;
$$;

revoke execute on function public.create_generation_job(uuid, text, text, text, int, text, text, int) from public, anon;
revoke execute on function public.start_generation_job(uuid) from public, anon;
revoke execute on function public.complete_generation_job(uuid, text, text, numeric, int, bigint) from public, anon;
revoke execute on function public.fail_generation_job(uuid, text) from public, anon;
revoke execute on function public.fail_stale_generation_jobs(int) from public, anon;

grant execute on function public.create_generation_job(uuid, text, text, text, int, text, text, int) to authenticated;
grant execute on function public.start_generation_job(uuid) to authenticated;
grant execute on function public.complete_generation_job(uuid, text, text, numeric, int, bigint) to authenticated;
grant execute on function public.fail_generation_job(uuid, text) to authenticated;
grant execute on function public.fail_stale_generation_jobs(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

-- Only audio, of a bounded size (a 60 s WAV is ~10 MB), can land in the bucket.
update storage.buckets
   set file_size_limit = 20971520, -- 20 MiB
       allowed_mime_types = array['audio/mpeg', 'audio/wav']
 where id = 'generations';

-- Lets the worker remove an object it uploaded when the completion step
-- fails. An object already referenced by an audio_assets row (a completed
-- job) cannot be deleted, so a library entry can never lose its audio.
create policy "generations: owner delete orphaned"
  on storage.objects for delete
  using (
    bucket_id = 'generations'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (
      select 1 from public.audio_assets a
       where a.storage_path = objects.name
    )
  );
