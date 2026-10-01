import { createServerSupabaseClient } from "@/lib/supabase/server";
import RhythmCard from "@/components/rhythms/rhythm-card";

export default async function LandingPage() {
  const supabase = await createServerSupabaseClient();
  const { data: rhythms } = await supabase
    .from("rhythms")
    .select("slug, name, description_fr, cultural_review_status")
    .eq("status", "published")
    .order("sort_order");

  return (
    <main className="px-6 py-12">
      <section className="max-w-2xl">
        <h1 className="text-4xl font-bold">Les rythmes du Bénin. Une nouvelle façon de créer.</h1>
        <p className="mt-4 text-lg">
          Crée des musiques originales inspirées des rythmes traditionnels béninois grâce à
          l&apos;intelligence artificielle.
        </p>
        <ol className="mt-6 flex flex-col gap-2 text-sm">
          <li>1. Choisis ton rythme</li>
          <li>2. Décris ton idée</li>
          <li>3. Écoute et télécharge ta création</li>
        </ol>
      </section>
      <section className="mt-12 grid gap-6 sm:grid-cols-3">
        {rhythms?.map((r) => (
          <RhythmCard
            key={r.slug}
            slug={r.slug}
            name={r.name}
            descriptionFr={r.description_fr}
            culturalReviewStatus={r.cultural_review_status as "unverified" | "reviewed"}
          />
        ))}
      </section>
    </main>
  );
}
