"use client";

import { useState } from "react";
import Cover from "@/components/brand/cover";
import ShareDialog from "@/components/tracks/share-dialog";
import { usePlayer } from "@/components/player/player-provider";
import { audioSrc, formatDuration, type Track } from "@/lib/tracks/types";

function downloadHref(track: Track) {
  return `${audioSrc(track)}?download=1`;
}

// The bar that stays at the bottom of every page once something has played:
// play/pause, previous/next, a clickable progress bar with times, download,
// and — for the member's own tracks — share (spec 2026-10-06 §5). On phones it
// takes two rows and sits just above the tab bar.
export default function PlayerBar() {
  const player = usePlayer();
  const [sharing, setSharing] = useState(false);
  const { current } = player;
  if (!current) return null;

  const total = player.duration || current.durationSeconds || 0;
  // A track played from a share link streams through `src`; only the owner's
  // own tracks (no `src`) can be shared from here.
  const ownTrack = !current.src;

  return (
    <>
      {/* Keeps page content from hiding under the bar. */}
      <div aria-hidden className="h-32 md:h-20" />
      <section
        aria-label="Lecteur"
        className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-ember bg-soot/95 backdrop-blur md:bottom-0"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 md:flex-nowrap md:gap-5 md:py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-3 md:flex-none md:basis-64">
            <Cover slug={current.rhythmSlug} seed={current.id} className="size-11 shrink-0 rounded-[10px]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ivory">{current.title}</p>
              <p className="truncate text-xs text-dust">
                {player.error ? <span className="text-danger">{player.error}</span> : current.rhythmName}
              </p>
            </div>
          </div>

          <div className="flex items-center">
            <IconButton label="Morceau précédent" onClick={player.previous} disabled={!player.hasPrevious}>
              <path d="M6 5v10M16 5 8 10l8 5V5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            </IconButton>
            <button
              type="button"
              onClick={player.toggle}
              aria-label={player.isPlaying ? "Pause" : "Lecture"}
              className="grid size-11 place-items-center rounded-full bg-ivory text-night transition hover:scale-105"
            >
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
                {player.isPlaying ? (
                  <path d="M6 4h3v12H6zM11 4h3v12h-3z" fill="currentColor" />
                ) : (
                  <path d="M6 4l10 6-10 6V4Z" fill="currentColor" />
                )}
              </svg>
            </button>
            <IconButton label="Morceau suivant" onClick={player.next} disabled={!player.hasNext}>
              <path d="M14 5v10M4 5l8 5-8 5V5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            </IconButton>
          </div>

          <div className="flex basis-full items-center gap-2 md:flex-1 md:basis-auto md:gap-3">
            <span className="w-9 text-right text-xs tabular-nums text-dust">{formatDuration(player.position)}</span>
            <input
              type="range"
              min={0}
              max={total || 0}
              step={0.1}
              value={Math.min(player.position, total || 0)}
              onChange={(e) => player.seek(Number(e.target.value))}
              aria-label="Position dans le morceau"
              className="h-11 flex-1 cursor-pointer accent-gold"
            />
            <span className="w-9 text-xs tabular-nums text-dust">{formatDuration(total)}</span>
            <a
              href={downloadHref(current)}
              aria-label="Télécharger"
              className="grid size-11 place-items-center rounded-full text-ivory transition hover:bg-soot-raised"
            >
              <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                <path d="M10 3v10m0 0-4-4m4 4 4-4M4 16h12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            {ownTrack && (
              <button
                type="button"
                onClick={() => setSharing(true)}
                aria-label="Partager"
                className="grid size-11 place-items-center rounded-full text-ivory transition hover:bg-soot-raised"
              >
                <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                  <circle cx="15" cy="4.5" r="2" />
                  <circle cx="5" cy="10" r="2" />
                  <circle cx="15" cy="15.5" r="2" />
                  <path d="M6.8 9 13.2 5.6M6.8 11l6.4 3.4" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </section>
      {sharing && <ShareDialog track={current} onChange={() => {}} onClose={() => setSharing(false)} />}
    </>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-11 place-items-center rounded-full text-ivory transition hover:bg-soot-raised disabled:opacity-30"
    >
      <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
