create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_locale text not null default 'fr' check (preferred_locale in ('fr', 'fon')),
  created_at timestamptz not null default now()
);

create table rhythms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  alternate_names text[] not null default '{}',
  description_fr text not null,
  description_fon text,
  cultural_review_status text not null default 'unverified'
    check (cultural_review_status in ('unverified', 'reviewed')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  rhythm_id uuid not null references rhythms(id),
  prompt text not null,
  mood text,
  energy text,
  duration_seconds int not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  provider text not null default 'stable-audio',
  idempotency_key text unique not null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table audio_assets (
  id uuid primary key default gen_random_uuid(),
  generation_job_id uuid not null unique references generation_jobs(id) on delete cascade,
  storage_path text not null,
  format text not null,
  duration_seconds numeric not null,
  sample_rate int not null,
  file_size_bytes bigint not null,
  created_at timestamptz not null default now()
);

create table usage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  generation_job_id uuid not null references generation_jobs(id) on delete cascade,
  estimated_cost numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table rhythms enable row level security;
alter table generation_jobs enable row level security;
alter table audio_assets enable row level security;
alter table usage_records enable row level security;

create policy "profiles: read own" on profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on profiles
  for update using (auth.uid() = id);
create policy "profiles: insert own" on profiles
  for insert with check (auth.uid() = id);

create policy "rhythms: public read published" on rhythms
  for select using (status = 'published');

create policy "generation_jobs: owner read" on generation_jobs
  for select using (auth.uid() = user_id);
create policy "generation_jobs: owner insert" on generation_jobs
  for insert with check (auth.uid() = user_id);

create policy "audio_assets: owner read" on audio_assets
  for select using (
    exists (
      select 1 from generation_jobs
      where generation_jobs.id = audio_assets.generation_job_id
        and generation_jobs.user_id = auth.uid()
    )
  );

create policy "usage_records: owner read" on usage_records
  for select using (auth.uid() = user_id);

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
