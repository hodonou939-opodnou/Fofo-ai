"use client";

import { useId } from "react";
import { coverFor, variationFor, type CoverMotif } from "@/lib/design/rhythm-covers";

// Decorative cover art for a rhythm or a track (see rhythm-covers.ts for the
// meaning of each motif). Size comes from the parent via className.
export default function Cover({
  slug,
  seed,
  className = "",
}: {
  slug: string | null | undefined;
  seed?: string;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const style = coverFor(slug);
  const v = variationFor(seed ?? slug ?? "fofo");
  const cx = 50 + v.offsetX * 0.6;
  const cy = 50 + v.offsetY * 0.6;

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ backgroundColor: style.base }} aria-hidden>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id={`glow-${id}`} cx={`${cx}%`} cy={`${cy}%`} r="65%">
            <stop offset="0%" stopColor={style.glow} stopOpacity="0.38" />
            <stop offset="100%" stopColor={style.glow} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`gold-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-gold-light)" />
            <stop offset="60%" stopColor="var(--color-gold)" />
            <stop offset="100%" stopColor="var(--color-bronze)" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#glow-${id})`} />
        <Motif motif={style.motif} cx={cx} cy={cy} rotation={v.rotation} gold={`url(#gold-${id})`} uid={id} />
      </svg>
    </div>
  );
}

function Motif({
  motif,
  cx,
  cy,
  rotation,
  gold,
  uid,
}: {
  motif: CoverMotif;
  cx: number;
  cy: number;
  rotation: number;
  gold: string;
  uid: string;
}) {
  switch (motif) {
    case "ripples":
      return (
        <g fill="none" stroke={gold}>
          {[7, 15, 25, 37, 51, 67].map((r, i) => (
            <circle key={r} cx={cx} cy={cy} r={r} strokeWidth={1.6 - i * 0.18} opacity={1 - i * 0.14} />
          ))}
          <circle cx={cx} cy={cy} r="2.6" fill={gold} stroke="none" />
        </g>
      );
    case "vessel": {
      // Nested silhouettes of a kpézin jar, upright with a slight tilt.
      const tilt = (rotation % 24) - 12;
      const jar = "M-9 -22 C-9 -26 9 -26 9 -22 C9 -18 6 -17 6 -14 C22 -10 26 6 18 18 C12 26 -12 26 -18 18 C-26 6 -22 -10 -6 -14 C-6 -17 -9 -18 -9 -22 Z";
      return (
        <g transform={`translate(${cx} ${cy + 6}) rotate(${tilt})`} fill="none" stroke={gold}>
          {[1, 1.45, 1.95, 2.55].map((s, i) => (
            <path key={s} d={jar} transform={`scale(${s})`} strokeWidth={1.4 / s} opacity={1 - i * 0.2} />
          ))}
        </g>
      );
    }
    case "moon": {
      // A moon over a ring of beats; the crescent's phase follows the track.
      const phase = ((rotation % 120) - 60) / 6; // -10..10
      return (
        <g>
          <mask id={`crescent-${uid}`}>
            <rect width="100" height="100" fill="white" />
            <circle cx={cx + 9 + phase} cy={cy - 6} r="17" fill="black" />
          </mask>
          <circle
            cx={cx}
            cy={cy}
            r="19"
            fill={gold}
            mask={`url(#crescent-${uid})`}
          />
          <g fill={gold}>
            {Array.from({ length: 16 }, (_, i) => {
              const a = ((i * 360) / 16 + rotation) * (Math.PI / 180);
              const accent = i % 4 === 0;
              return (
                <circle
                  key={i}
                  cx={cx + Math.cos(a) * 34}
                  cy={cy + Math.sin(a) * 34}
                  r={accent ? 2.2 : 1.1}
                  opacity={accent ? 0.95 : 0.55}
                />
              );
            })}
          </g>
        </g>
      );
    }
    default:
      // Concentric diamonds, echoing the pattern inside the Fofo logo.
      return (
        <g transform={`translate(${cx} ${cy}) rotate(45)`} fill="none" stroke={gold}>
          {[6, 13, 21, 30, 40].map((s, i) => (
            <rect key={s} x={-s} y={-s} width={s * 2} height={s * 2} strokeWidth="1.3" opacity={1 - i * 0.17} />
          ))}
        </g>
      );
  }
}
