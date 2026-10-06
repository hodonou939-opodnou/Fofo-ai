import type { SupabaseClient } from "@supabase/supabase-js";
import { youtubeId } from "@/lib/rhythms/youtube";

// Read-only access to the rhythm catalog and its cultural content
// (migration 0006: region, instruments, rhythm_references from the product
// owner's spreadsheet). Public data — RLS lets anyone read published rhythms.

export type RhythmSummary = {
  slug: string;
  name: string;
  region: string | null;
  descriptionFr: string;
  alternateNames: string[];
  instruments: string[];
  culturalReviewStatus: "unverified" | "reviewed";
};

export type RhythmReference = {
  id: string;
  artist: string;
  role: string;
  style: string | null;
  knownWorks: string | null;
  videoUrl: string | null;
};

export type FeaturedVideo = {
  rhythmSlug: string;
  rhythmName: string;
  artist: string;
  title: string;
  url: string;
};

type RhythmRow = {
  slug: string;
  name: string;
  region: string | null;
  description_fr: string;
  alternate_names: string[] | null;
  instruments: string[] | null;
  cultural_review_status: "unverified" | "reviewed";
};

type ReferenceRow = {
  id: string;
  artist: string;
  role: string;
  style: string | null;
  known_works: string | null;
  video_url: string | null;
};

const RHYTHM_COLUMNS = "slug, name, region, description_fr, alternate_names, instruments, cultural_review_status";

function toSummary(row: RhythmRow): RhythmSummary {
  return {
    slug: row.slug,
    name: row.name,
    region: row.region,
    descriptionFr: row.description_fr,
    alternateNames: row.alternate_names ?? [],
    instruments: row.instruments ?? [],
    culturalReviewStatus: row.cultural_review_status,
  };
}

function toReference(row: ReferenceRow): RhythmReference {
  return {
    id: row.id,
    artist: row.artist,
    role: row.role,
    style: row.style,
    knownWorks: row.known_works,
    videoUrl: row.video_url,
  };
}

export async function getPublishedRhythms(supabase: SupabaseClient): Promise<RhythmSummary[]> {
  const { data } = await supabase
    .from("rhythms")
    .select(RHYTHM_COLUMNS)
    .eq("status", "published")
    .order("sort_order");
  return ((data as RhythmRow[] | null) ?? []).map(toSummary);
}

export async function getRhythmWithReferences(
  supabase: SupabaseClient,
  slug: string
): Promise<{ rhythm: RhythmSummary; references: RhythmReference[] } | null> {
  const { data } = await supabase
    .from("rhythms")
    .select(`${RHYTHM_COLUMNS}, rhythm_references(id, artist, role, style, known_works, video_url, sort_order)`)
    .eq("slug", slug)
    .eq("status", "published")
    .order("sort_order", { referencedTable: "rhythm_references" })
    .maybeSingle();
  if (!data) return null;
  const row = data as RhythmRow & { rhythm_references: ReferenceRow[] | null };
  return { rhythm: toSummary(row), references: (row.rhythm_references ?? []).map(toReference) };
}

// One playable video per rhythm, for the home page.
export async function getFeaturedVideos(supabase: SupabaseClient): Promise<FeaturedVideo[]> {
  const { data } = await supabase
    .from("rhythms")
    .select("slug, name, rhythm_references(artist, known_works, video_url, sort_order)")
    .eq("status", "published")
    .order("sort_order")
    .order("sort_order", { referencedTable: "rhythm_references" });
  const rows =
    (data as
      | { slug: string; name: string; rhythm_references: { artist: string; known_works: string | null; video_url: string | null }[] }[]
      | null) ?? [];

  return rows.flatMap((r) => {
    const ref = r.rhythm_references.find((x) => youtubeId(x.video_url));
    if (!ref?.video_url) return [];
    return [
      {
        rhythmSlug: r.slug,
        rhythmName: r.name,
        artist: ref.artist,
        title: ref.known_works?.split(" ; ")[0] ?? ref.artist,
        url: ref.video_url,
      },
    ];
  });
}
