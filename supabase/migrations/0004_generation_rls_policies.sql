-- The Phase 1 foundation migration only granted owners SELECT on
-- generation_jobs/audio_assets/usage_records and INSERT on generation_jobs.
-- The generation pipeline needs the owner to also update their own job's
-- status and insert their own audio_assets/usage_records rows directly
-- (the app intentionally never uses the service-role key at runtime).
-- Without these, writes are silently dropped by RLS (0 rows affected, no
-- error), which left jobs stuck in 'queued' forever.

create policy "generation_jobs: owner update"
  on generation_jobs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "audio_assets: owner insert"
  on audio_assets for insert
  with check (
    exists (
      select 1 from generation_jobs
      where generation_jobs.id = audio_assets.generation_job_id
        and generation_jobs.user_id = auth.uid()
    )
  );

create policy "usage_records: owner insert"
  on usage_records for insert
  with check (auth.uid() = user_id);
