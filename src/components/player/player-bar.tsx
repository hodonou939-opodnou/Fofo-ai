"use client";

import Cover from "@/components/brand/cover";
import { usePlayer } from "@/components/player/player-provider";
import { formatDuration } from "@/lib/tracks/types";

// The bar that stays at the bottom of every page once something has played.
// On phones it sits just above the tab bar.
export default function PlayerBar() {
  const player = usePlayer();
  const { current } = player;
  if (!current) return null;

  const total = player.duration || current.durationSeconds || 0;
  const progress = total > 0 ? Math.min(100, (player.position / total) * 100) : 0;

  return (
    <>
      {/* Keeps page content from hiding under the bar. */}
      <div aria-hidden className="h-20" />
      <section
        aria-label="Lecteur"
        className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-ember bg-soot/95 backdrop-blur md:bottom-0"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 md:gap-5">
          <Cover slug={current.rhythmSlug} seed={current.id} className="size-11 shrink-0 rounded-[10px]" />
          <div className="min-w-0 flex-1 md:flex-none md:basis-56">
            <p className="truncate text-sm font-semibold text-ivory">{current.title}</p>
            <p className="truncate text-xs text-dust">
              {player.error ? <span className="text-danger">{player.error}</span> : current.rhythmName}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <IconButton label="Morceau précédent" onClick={player.previous} disabled={!player.hasPrevious} className="hidden sm:grid">
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
            <IconButton label="Morceau suivant" onClick={player.next} disabled={!player.hasNext} className="hidden sm:grid">
              <path d="M14 5v10M4 5l8 5-8 5V5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            </IconButton>
          </div>

          <div className="hidden flex-1 items-center gap-3 md:flex">
            <span className="w-10 text-right text-xs tabular-nums text-dust">{formatDuration(player.position)}</span>
            <input
              type="range"
              min={0}
              max={total || 0}
              step={0.1}
              value={Math.min(player.position, total || 0)}
              onChange={(e) => player.seek(Number(e.target.value))}
              aria-label="Position dans le morceau"
              className="h-1 flex-1 cursor-pointer accent-gold"
            />
            <span className="w-10 text-xs tabular-nums text-dust">{formatDuration(total)}</span>
          </div>
        </div>
        {/* Thin progress line for phones, where the slider is hidden. */}
        <div className="h-0.5 bg-ember md:hidden">
          <div className="h-full bg-gold" style={{ width: `${progress}%` }} />
        </div>
      </section>
    </>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  className = "",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`size-10 place-items-center rounded-full text-ivory transition hover:bg-soot-raised disabled:opacity-30 ${className}`}
    >
      <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
