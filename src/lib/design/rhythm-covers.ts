// Cover art per rhythm (spec 2026-10-06 §3). Free, generated in SVG, never an
// AI image. Each motif comes from the rhythm itself:
//   Tchinkounmè — ripples: its water percussion (tohoun)
//   Zinli       — vessel arcs: the kpézin jar, its main instrument
//   Toba        — moon: once played by moonlight to pass on tales
// A track adds a stable per-track variation so a grid of one rhythm is not a
// wall of identical tiles.

export type CoverMotif = "ripples" | "vessel" | "moon" | "neutral";

export type CoverStyle = {
  motif: CoverMotif;
  /** Deep background colour (CSS custom property). */
  base: string;
  /** Glow colour behind the motif. */
  glow: string;
};

const COVERS: Record<string, CoverStyle> = {
  tchinkounme: { motif: "ripples", base: "var(--color-oxblood)", glow: "var(--color-gold-light)" },
  zinli: { motif: "vessel", base: "var(--color-lagoon)", glow: "var(--color-gold)" },
  toba: { motif: "moon", base: "var(--color-dusk)", glow: "var(--color-gold-light)" },
};

const NEUTRAL: CoverStyle = { motif: "neutral", base: "var(--color-soot-raised)", glow: "var(--color-gold)" };

export function coverFor(slug: string | null | undefined): CoverStyle {
  return (slug && COVERS[slug]) || NEUTRAL;
}

export type CoverVariation = { rotation: number; offsetX: number; offsetY: number };

// FNV-1a: tiny, deterministic, good enough spread for decorative variation.
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function variationFor(seed: string): CoverVariation {
  const h = hash(seed);
  return {
    rotation: h % 360,
    offsetX: ((h >>> 9) % 41) - 20,
    offsetY: ((h >>> 17) % 41) - 20,
  };
}
