"use client";

import Image from "next/image";
import { useState } from "react";
import { youtubeEmbed, youtubeId, youtubeThumbnail } from "@/lib/rhythms/youtube";

// A reference video that costs nothing until it is wanted: a thumbnail and a
// play button first, then YouTube's privacy-enhanced player on click.
// Channel pages can't be embedded, so they open in a new tab.
export default function VideoFacade({
  url,
  title,
  artist,
}: {
  url: string;
  title: string;
  artist: string;
}) {
  const [playing, setPlaying] = useState(false);
  const id = youtubeId(url);

  if (!id) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex aspect-video flex-col justify-end rounded-panel border border-ember bg-soot p-5 transition hover:border-gold/60"
      >
        <span className="text-sm text-dust">{artist}</span>
        <span className="mt-1 font-semibold text-ivory">Voir la chaîne YouTube</span>
        <span className="mt-1 text-sm text-dust">{title}</span>
      </a>
    );
  }

  if (playing) {
    return (
      <div className="aspect-video overflow-hidden rounded-panel border border-ember bg-night">
        <iframe
          src={youtubeEmbed(id)}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Lire la vidéo : ${title}`}
      className="group relative block aspect-video w-full overflow-hidden rounded-panel border border-ember bg-night text-left"
    >
      <Image
        src={youtubeThumbnail(id)}
        alt=""
        fill
        sizes="(min-width: 768px) 33vw, 100vw"
        className="object-cover opacity-80 transition group-hover:scale-[1.03] group-hover:opacity-100"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-night via-night/30 to-transparent" />
      <span className="absolute top-1/2 left-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-ivory/95 text-night shadow-lift transition group-hover:scale-110">
        <svg viewBox="0 0 20 20" className="ml-0.5 size-5" aria-hidden>
          <path d="M6 4l10 6-10 6V4Z" fill="currentColor" />
        </svg>
      </span>
      <span className="absolute inset-x-0 bottom-0 p-4">
        <span className="block text-xs text-dust">{artist}</span>
        <span className="mt-0.5 line-clamp-2 block text-sm font-semibold text-ivory">{title}</span>
      </span>
    </button>
  );
}
