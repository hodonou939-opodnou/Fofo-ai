import type { Metadata } from "next";
import RhythmCard from "@/components/rhythms/rhythm-card";
import { getPublishedRhythms } from "@/lib/rhythms/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Les rythmes",
  description: "Tchinkounmè, Zinli, Toba : l'histoire, les instruments et les maîtres des rythmes du Bénin.",
};

export default async function RhythmsPage() {
  const supabase = await createServerSupabaseClient();
  const rhythms = await getPublishedRhythms(supabase);

  return (
    <main className="mx-auto max-w-6xl px-4 pt-12 pb-16 md:px-6">
      <div className="max-w-2xl">
        <h1 className="font-display text-6xl text-ivory md:text-7xl">Les rythmes</h1>
        <p className="mt-5 text-lg leading-relaxed text-dust">
          Chaque rythme a une origine, des instruments et des maîtres qui le font vivre. Découvre-les avant de créer.
        </p>
      </div>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rhythms.map((r) => (
          <RhythmCard
            key={r.slug}
            slug={r.slug}
            name={r.name}
            region={r.region}
            descriptionFr={r.descriptionFr}
            culturalReviewStatus={r.culturalReviewStatus}
          />
        ))}
      </div>
    </main>
  );
}
