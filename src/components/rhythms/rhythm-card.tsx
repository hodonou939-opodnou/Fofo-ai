import Link from "next/link";

type Props = {
  slug: string;
  name: string;
  descriptionFr: string;
  culturalReviewStatus: "unverified" | "reviewed";
};

export default function RhythmCard({ slug, name, descriptionFr, culturalReviewStatus }: Props) {
  return (
    <Link
      href={`/rythmes/${slug}`}
      className="block rounded-xl border border-[var(--color-ink)]/10 p-6 hover:border-[var(--color-gold-start)]"
    >
      <h3 className="text-xl font-semibold">{name}</h3>
      <p className="mt-2 text-sm text-[var(--color-ink)]/80">{descriptionFr}</p>
      {culturalReviewStatus === "unverified" && (
        <p className="mt-3 text-xs italic text-[var(--color-ink)]/60">
          Description en validation culturelle en cours.
        </p>
      )}
    </Link>
  );
}
