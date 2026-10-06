-- Experience redesign (spec 2026-10-06 §6–§7): track titles, share links,
-- soft delete, and the rhythm cultural content (region, instruments, masters,
-- reference videos) from the product owner's spreadsheet
-- "Liste_Rythmes_Tchinkoume_Toba_Zinli_Artistes.xlsx" — copied verbatim, never
-- invented. The running app still never uses the service-role key: every new
-- write goes through an owner-checked SECURITY DEFINER function, like 0005.

-- ---------------------------------------------------------------------------
-- generation_jobs: title, share link, soft delete
-- ---------------------------------------------------------------------------

alter table public.generation_jobs
  add column title text,
  add column share_token text unique,
  add column deleted_at timestamptz;

update public.generation_jobs
   set title = nullif(left(btrim(prompt), 60), '')
 where title is null;

alter table public.generation_jobs
  add constraint generation_jobs_title_length
  check (title is null or char_length(title) between 1 and 80);

-- Default title = start of the user's idea, so create_generation_job keeps its
-- signature (the route and its tests are unchanged).
create function public.generation_jobs_default_title()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title := coalesce(nullif(btrim(new.title), ''), nullif(left(btrim(new.prompt), 60), ''));
  return new;
end;
$$;

create trigger generation_jobs_default_title
  before insert on public.generation_jobs
  for each row execute function public.generation_jobs_default_title();

-- Rename: owner only, not deleted, 1–80 characters after trimming.
create function public.rename_generation_job(p_job_id uuid, p_title text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
begin
  if char_length(v_title) < 1 or char_length(v_title) > 80 then
    raise exception 'title must be 1 to 80 characters' using errcode = '22023';
  end if;

  perform 1
    from public.generation_jobs j
   where j.id = p_job_id
     and j.user_id = auth.uid()
     and j.deleted_at is null
     for update;
  if not found then
    raise exception 'generation job % not found', p_job_id using errcode = 'P0002';
  end if;

  update public.generation_jobs set title = v_title where id = p_job_id;
end;
$$;

-- Share on/off. Enabling a completed job returns its token (reused if already
-- shared); disabling clears it, which immediately kills the public link.
-- Token: two 12-hex-char prefixes of v4 UUIDs (the fully random part of a
-- gen_random_uuid() value) = 24 hex chars, 96 random bits, no extension needed.
create function public.set_generation_job_sharing(p_job_id uuid, p_enabled boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_token text;
begin
  select j.status, j.share_token into v_status, v_token
    from public.generation_jobs j
   where j.id = p_job_id
     and j.user_id = auth.uid()
     and j.deleted_at is null
     for update;
  if not found then
    raise exception 'generation job % not found', p_job_id using errcode = 'P0002';
  end if;

  if not coalesce(p_enabled, false) then
    update public.generation_jobs set share_token = null where id = p_job_id;
    return null;
  end if;

  if v_status <> 'completed' then
    raise exception 'only a completed generation job can be shared (status %)', v_status
      using errcode = '55000';
  end if;

  if v_token is null then
    v_token := left(replace(gen_random_uuid()::text, '-', ''), 12)
            || left(replace(gen_random_uuid()::text, '-', ''), 12);
    update public.generation_jobs set share_token = v_token where id = p_job_id;
  end if;
  return v_token;
end;
$$;

-- Soft delete: the row stays (so the hourly rate limit and usage history can't
-- be dodged by deleting), but it is hidden, unshared, and loses its
-- audio_assets row. Returns the storage path so the route can then remove the
-- object, which 0005's "owner delete orphaned" policy now allows.
create function public.delete_generation_job(p_job_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_deleted_at timestamptz;
  v_path text;
begin
  select j.status, j.deleted_at into v_status, v_deleted_at
    from public.generation_jobs j
   where j.id = p_job_id
     and j.user_id = auth.uid()
     for update;
  if not found then
    raise exception 'generation job % not found', p_job_id using errcode = 'P0002';
  end if;
  if v_deleted_at is not null or v_status not in ('completed', 'failed', 'cancelled') then
    raise exception 'cannot delete generation job % (status %, deleted %)', p_job_id, v_status, v_deleted_at
      using errcode = '55000';
  end if;

  delete from public.audio_assets a
   where a.generation_job_id = p_job_id
  returning a.storage_path into v_path;

  update public.generation_jobs
     set deleted_at = now(),
         share_token = null
   where id = p_job_id;

  return v_path;
end;
$$;

-- Public read of one shared track, by token only. Never lists anything.
create function public.get_shared_track(p_token text)
returns table (
  job_id uuid,
  title text,
  rhythm_name text,
  rhythm_slug text,
  duration_seconds numeric,
  format text,
  storage_path text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id, j.title, r.name, r.slug, a.duration_seconds, a.format, a.storage_path, j.created_at
    from public.generation_jobs j
    join public.audio_assets a on a.generation_job_id = j.id
    left join public.rhythms r on r.id = j.rhythm_id
   where p_token is not null
     and j.share_token = p_token
     and j.status = 'completed'
     and j.deleted_at is null;
$$;

-- Storage-policy helper: SECURITY DEFINER because anonymous visitors cannot
-- read audio_assets/generation_jobs themselves.
create function public.is_shared_generation_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.audio_assets a
      join public.generation_jobs j on j.id = a.generation_job_id
     where a.storage_path = p_name
       and j.share_token is not null
       and j.status = 'completed'
       and j.deleted_at is null
  );
$$;

revoke execute on function public.rename_generation_job(uuid, text) from public, anon;
revoke execute on function public.set_generation_job_sharing(uuid, boolean) from public, anon;
revoke execute on function public.delete_generation_job(uuid) from public, anon;
revoke execute on function public.get_shared_track(text) from public;
revoke execute on function public.is_shared_generation_object(text) from public;

grant execute on function public.rename_generation_job(uuid, text) to authenticated;
grant execute on function public.set_generation_job_sharing(uuid, boolean) to authenticated;
grant execute on function public.delete_generation_job(uuid) to authenticated;
grant execute on function public.get_shared_track(text) to anon, authenticated;
grant execute on function public.is_shared_generation_object(text) to anon, authenticated;

-- Anyone holding a live share link can stream (sign a URL for) that one object.
create policy "generations: read shared"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'generations'
    and public.is_shared_generation_object(name)
  );

-- ---------------------------------------------------------------------------
-- Rhythm cultural content (feuilles « Liste par Rythme » et « Légende et Infos »)
-- ---------------------------------------------------------------------------

alter table public.rhythms
  add column region text,
  add column instruments text[] not null default '{}';

update public.rhythms set
  region = 'Savalou (Collines)',
  instruments = array['Percussions aquatiques (tohoun)', 'Gota (gourde)'],
  description_fr = 'Rythme mahi de Savalou (Collines). Percussions aquatiques (tohoun) + gota (gourde). Origine funéraire, devenu festif. Modernisé en Tchink System par Stan Tohon.'
where slug = 'tchinkounme';

update public.rhythms set
  region = 'Abomey (Zou)',
  instruments = array['Kpézin (jarre)'],
  description_fr = 'Rythme fon d’Abomey (Zou). Créé sous le roi Glèlè (XIXe s.). À l’origine funéraire royal. Instrument principal : kpézin (jarre). Modernisé en Zinli rénové par Alèkpéhanhou.'
where slug = 'zinli';

update public.rhythms set
  region = 'Collines, Zou, Atlantique, Littoral',
  description_fr = 'Rythme populaire (influence yoruba-nago). Présent dans Collines, Zou, Atlantique, Littoral. Autrefois joué au clair de lune pour transmettre contes et savoirs. Utilisé pour fêtes, mariages, funérailles. Souvent associé au Hanyé.'
where slug = 'toba';

create table public.rhythm_references (
  id uuid primary key default gen_random_uuid(),
  rhythm_id uuid not null references public.rhythms(id) on delete cascade,
  artist text not null,
  role text not null,
  style text,
  known_works text,
  video_url text,
  sort_order int not null default 0
);

create index rhythm_references_rhythm_id_idx on public.rhythm_references (rhythm_id, sort_order);

alter table public.rhythm_references enable row level security;

create policy "rhythm_references: public read published"
  on public.rhythm_references for select
  using (
    exists (
      select 1 from public.rhythms r
       where r.id = rhythm_references.rhythm_id
         and r.status = 'published'
    )
  );

insert into public.rhythm_references (rhythm_id, artist, role, style, known_works, video_url, sort_order)
select r.id, v.artist, v.role, v.style, v.known_works, v.video_url, v.sort_order
  from (values
    ('tchinkounme', 'Anatole Houndéfo (Alokpon)', 'Roi historique du Tchinkounmè (Savalou). Modernisateur années 60-70.', 'Traditionnel → moderne', null, null, 1),
    ('tchinkounme', 'Alokpon Junior (Sèhomi)', 'Fille / héritière d''Alokpon', 'Traditionnel', null, null, 2),
    ('tchinkounme', 'Stan Tohon (Tohon Stanislas)', 'Créateur du Tchink System (version électrifiée, soul/funk)', 'Tchink System (moderne)', 'Dans Son Nouveau Style Tchink System (album) ; Djessoudo ; We Want To Know', 'https://www.youtube.com/watch?v=V_vhDs2oQmQ', 3),
    ('tchinkounme', 'Gbèzé Zeguezougou', 'Souvent appelé Roi actuel du Tchinkounmè (Savalou). Joue aussi Toba.', 'Traditionnel + moderne', 'Gbèzé tchinkounmè ; GBEZE 01 toba toba', 'https://www.youtube.com/watch?v=9FcyjPzXwX0', 4),
    ('tchinkounme', 'Gbétchéou', 'Grand précurseur actuel du Tchinkoumè', 'Traditionnel', 'Bénin VALORISATION DU RYTHME TCHINKOUMÈ (Africa 24)', 'https://www.youtube.com/watch?v=SwJF5qM-5p4', 5),
    ('tchinkounme', 'Allèvi / Allevi (Papa Tobaton)', 'Artiste majeur Tchinkounmè et Toba', 'Traditionnel', 'Allèvi tchink / toba ; ALLEVI danse avec sa femme', 'https://www.youtube.com/watch?v=r0CWf0f-B5Y', 6),
    ('tchinkounme', 'Zokpé', 'Artiste contemporain Tchinkounmè', 'Traditionnel moderne', 'Gbènon valou - Zokpé dans le rythme Tchinkounmè', 'https://www.youtube.com/watch?v=DiBVDtVpZOo', 7),
    ('tchinkounme', 'Bobo D. / Tina Seglé / Vovo Vilaup / Les Teriba', 'Artistes ayant adopté le Tchink (modernes)', 'Tchink System / variété', null, null, 8),
    ('zinli', 'Alèkpéhanhou (Michel Loucou / Claude Michel Loucou)', 'Roi du Zinli rénové (Abomey). A transformé le rythme funéraire en musique festive.', 'Zinli rénové', 'Chaîne : Le Roi Alekpehanhou ; Mi Nou Mi Ni Mon Midé Gbô ; Aligbo Oun Wa ; Kakpo Sin Han', 'https://www.youtube.com/@leroialekpehanhou/videos', 1),
    ('zinli', 'Alekpehanhou (même artiste)', 'Vidéos classiques et playlists Awesome Tapes', 'Traditionnel / rénové', 'Mi Nou Mi Ni Mon Midé Gbô (Radio Ethiopia / Awesome Tapes)', 'https://www.youtube.com/watch?v=MU_n-NoGkKM', 2),
    ('zinli', 'Kesse / Adize / Zondo', 'Artistes pratiquant le Zinli rénové', 'Zinli rénové', null, null, 3),
    ('zinli', 'Anciens (HOONON HOULOVO, TOKANNOU AGBÉOUNKPAN, etc.)', 'Chanteurs traditionnels historiques d''Abomey', 'Traditionnel funéraire', null, null, 4),
    ('toba', 'Gbèzé Zeguezougou', 'Roi du Toba et du Tchinkounmè (Collines)', 'Traditionnel', 'GBEZE 01 toba toba (>600k vues)', 'https://www.youtube.com/watch?v=9FcyjPzXwX0', 1),
    ('toba', 'Allèvi / Papa Tobaton Allevi', 'Maître du Toba / Hanyé', 'Traditionnel', 'ALLEVI danse avec sa femme ; toba Allèvi', 'https://www.youtube.com/watch?v=r0CWf0f-B5Y', 2),
    ('toba', 'Ezin Gangnon', 'Référence historique du Toba', 'Traditionnel', 'Ezin Gangnon (Toba di weman do houn)', 'https://www.youtube.com/watch?v=3qdGVReB-38', 3),
    ('toba', 'Koudomanzoun Louha', 'Maître du rythme Toba', 'Traditionnel', 'LOUHA (Chacun danse sur son tambour)', 'https://www.youtube.com/watch?v=iVDakJETiss', 4),
    ('toba', 'Alèdo Aïfa / Zosse / Amanton / Tchékpon / Denis Dakossi / dah Tamadaho', 'Artistes et groupes historiques du Toba', 'Traditionnel', null, null, 5),
    ('toba', 'Prince Kanze / Prince Mintokan Kanze', 'Toba international / moderne', 'Moderne', 'LE TOBA INTERNATIONAL DE L''ARTISTE PRINCE KANZE', 'https://www.youtube.com/watch?v=NyO3E5Wky-g', 6),
    ('toba', 'Sezonmon Alosse', 'Album 70s Toba-Hanye', 'Afro Folk 70s', 'Soclub - Toba - Hanye (album complet)', 'https://www.youtube.com/watch?v=iucF39GAbmc', 7)
  ) as v(slug, artist, role, style, known_works, video_url, sort_order)
  join public.rhythms r on r.slug = v.slug;
