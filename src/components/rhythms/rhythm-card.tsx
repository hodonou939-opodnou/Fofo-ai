import Link from "next/link";
import Cover from "@/components/brand/cover";

type Props = {
  slug: string;
  name: string;
  region: string | null;
  descriptionFr: string;
  culturalReviewStatus: "unverified" | "reviewed";
};

export default function RhythmCard({ slug, name, region, descriptionFr, culturalReviewStatus }: Props) {
  return (
    <Link
      href={`/rythmes/${slug}`}
      className="group flex flex-col overflow-hidden rounded-panel border border-ember bg-soot transition hover:border-gold/50"
    >
      <Cover slug={slug} seed={`rhythm-${slug}`} className="aspect-[4/3] w-full" />
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-4xl text-ivory">{name}</h3>
        {region && <p className="mt-2 text-sm text-gold-light">{region}</p>}
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-dust">{descriptionFr}</p>
        <span className="mt-auto pt-5 text-sm font-medium text-ivory group-hover:text-gold-light">
          Découvrir le rythme
        </span>
        {culturalReviewStatus === "unverified" && (
          <p className="mt-2 text-xs text-dust/80">Description en validation culturelle en cours.</p>
        )}
      </div>
    </Link>
  );
}
