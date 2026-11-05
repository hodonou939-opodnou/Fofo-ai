import { ENERGY_DESCRIPTORS, MOOD_DESCRIPTORS, type DurationSeconds, type Energy, type Mood } from "./options";
import { rhythmStyle } from "./rhythm-styles";

// An ElevenLabs composition plan (music_v2 / music_v2_5 "chunks"). Fofo builds a
// skeleton that pins the rhythm — identity, instruments, tempo, feel — and the
// exclusions; the free planner endpoint only weaves the user's idea into it,
// and enforcePlan keeps whatever it returns inside Fofo's frame.
export type ContextAdherence = "low" | "medium" | "high";

export type PlanChunk = {
  text: string;
  duration_ms: number;
  positive_styles: string[];
  negative_styles: string[];
  context_adherence: ContextAdherence;
};

export type CompositionPlan = { chunks: PlanChunk[] };

// What the provider needs to compose: Fofo's skeleton, and the prompt that asks
// the planner to fit the user's idea into it.
export type Composition = { skeleton: CompositionPlan; idea: string };

const MAX_STYLES = 50; // per list, per chunk (ElevenLabs)

// Everything Fofo makes is instrumental, and generic models drift toward
// Western or electronic production and modern Afro-pop when asked for "African
// rhythm": excluded in every section.
const COMMON_NEGATIVES = [
  "vocals",
  "singing",
  "lyrics",
  "choir",
  "spoken word",
  "drum kit",
  "snare drum",
  "hi-hats",
  "808 bass",
  "synthesizer",
  "electronic beats",
  "EDM",
  "four-on-the-floor kick",
  "electric guitar",
  "bass guitar",
  "piano",
  "orchestral strings",
  "brass section",
  "Western pop production",
  "Afrobeats",
  "Amapiano",
  "reggaeton",
  "Latin percussion",
  "steel drums",
];

// Planner styles that would bring those back, or impose another tempo or meter
// than Fofo's: dropped. Fofo's own styles are never filtered.
const BANNED_PLANNER_STYLES = [
  /\b(vocals?|voices?|sing(?:s|ing|ers?)?|sung|lyrics?|choir|chant\w*|rap(?:s|ping|pers?)?|spoken)\b/i,
  /\b(drum kit|drum machine|snare|hi-?hats?|808|trap|synth\w*|edm|electronic|guitars?|piano|keyboards?|organ|strings|orchestral|brass|horns?|saxophone|trumpet)\b/i,
  /\b(afro-?beats?|amapiano|reggaeton|dancehall|pop|hip[- ]?hop|house|techno)\b/i,
  /\b\d{2,3}\s*bpm\b/i,
  /\b\d{1,2}\/\d{1,2}\b/,
];

type Section = { name: string; share: number; role: string };

const INTRO = "sparse opening: one percussion part alone, the others join one by one";
const GROOVE = "full ensemble groove with interlocking polyrhythms";
const VARIATION = "lead drum improvises over the steady ensemble pattern";
const OUTRO = "ensemble thins out and ends together on a final stroke";

// Shares of the track; the last section takes the rounding remainder.
const SECTIONS: Record<DurationSeconds, Section[]> = {
  15: [{ name: "Groove", share: 1, role: GROOVE }],
  30: [
    { name: "Intro", share: 0.2, role: INTRO },
    { name: "Groove", share: 0.8, role: GROOVE },
  ],
  60: [
    { name: "Intro", share: 8 / 60, role: INTRO },
    { name: "Groove", share: 28 / 60, role: GROOVE },
    { name: "Variation", share: 16 / 60, role: VARIATION },
    { name: "Outro", share: 8 / 60, role: OUTRO },
  ],
};

export function buildComposition(params: {
  rhythmSlug: string;
  rhythmName: string;
  userIdea: string;
  mood: Mood;
  energy: Energy;
  durationSeconds: DurationSeconds;
}): Composition {
  const { rhythmSlug, rhythmName, userIdea, mood, energy, durationSeconds } = params;
  const style = rhythmStyle(rhythmSlug, rhythmName);
  const pulse = [style.bpm ? `${style.bpm} BPM` : null, style.feel ?? null].filter((s): s is string => s !== null);
  const moodStyle = `${MOOD_DESCRIPTORS[mood]} mood`;
  const energyStyle = `${ENERGY_DESCRIPTORS[energy]} energy`;
  const negative = dedupe([...COMMON_NEGATIVES, ...style.negative]).slice(0, MAX_STYLES);

  const sections = SECTIONS[durationSeconds];
  const totalMs = durationSeconds * 1000;
  let usedMs = 0;
  const chunks = sections.map((section, i): PlanChunk => {
    const isLast = i === sections.length - 1;
    const duration_ms = isLast ? totalMs - usedMs : Math.round((totalMs * section.share) / 1000) * 1000;
    usedMs += duration_ms;
    const positive =
      i === 0
        ? [style.identity, ...style.positive, ...pulse, moodStyle, energyStyle, section.role]
        : [style.identity, ...style.positive.slice(0, 1), ...pulse, moodStyle, section.role];
    return {
      text: `[${section.name}]`,
      duration_ms,
      positive_styles: dedupe(positive).slice(0, MAX_STYLES),
      negative_styles: [...negative],
      context_adherence: "high",
    };
  });

  const idea =
    `${userIdea}\n\n` +
    `Keep the rhythm, tempo, instruments, sections and exclusions of the source plan; ` +
    `only add styles that bring this idea into it. Instrumental only, no vocals.`;

  return { skeleton: { chunks }, idea };
}

// Fits the planner's answer into Fofo's frame: same sections and lengths, Fofo's
// styles first, nothing banned, no lyrics, no audio reference. Anything
// malformed or restructured falls back to the skeleton itself.
export function enforcePlan(skeleton: CompositionPlan, candidate: unknown): CompositionPlan {
  const chunks = candidateChunks(candidate);
  if (!chunks || chunks.length !== skeleton.chunks.length) return skeleton;
  if (chunks.some((c, i) => c.duration_ms !== skeleton.chunks[i].duration_ms)) return skeleton;

  return {
    chunks: skeleton.chunks.map((own, i) => {
      const theirs = chunks[i];
      const extras = theirs.positive_styles.filter((s) => !BANNED_PLANNER_STYLES.some((re) => re.test(s)));
      const positive_styles = dedupe([...own.positive_styles, ...extras]).slice(0, MAX_STYLES);
      const wanted = new Set(positive_styles.map(key));
      const negative_styles = dedupe([...own.negative_styles, ...theirs.negative_styles])
        .filter((s) => !wanted.has(key(s)))
        .slice(0, MAX_STYLES);
      const directions = theirs.text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => /^\{[^{}]{1,198}\}$/.test(line));
      return {
        text: [own.text, ...directions].join("\n"),
        duration_ms: own.duration_ms,
        positive_styles,
        negative_styles,
        context_adherence: isAdherence(theirs.context_adherence) ? theirs.context_adherence : "high",
      };
    }),
  };
}

type CandidateChunk = {
  text: string;
  duration_ms: number;
  positive_styles: string[];
  negative_styles: string[];
  context_adherence?: unknown;
};

function candidateChunks(candidate: unknown): CandidateChunk[] | null {
  if (typeof candidate !== "object" || candidate === null) return null;
  const chunks = (candidate as { chunks?: unknown }).chunks;
  if (!Array.isArray(chunks) || chunks.length === 0) return null;
  const valid: CandidateChunk[] = [];
  for (const chunk of chunks) {
    if (typeof chunk !== "object" || chunk === null) return null;
    const c = chunk as Record<string, unknown>;
    const negative = c.negative_styles ?? [];
    if (typeof c.text !== "string" || typeof c.duration_ms !== "number") return null;
    if (!isStringList(c.positive_styles) || !isStringList(negative)) return null;
    valid.push({
      text: c.text,
      duration_ms: c.duration_ms,
      positive_styles: c.positive_styles,
      negative_styles: negative,
      context_adherence: c.context_adherence,
    });
  }
  return valid;
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function isAdherence(value: unknown): value is ContextAdherence {
  return value === "low" || value === "medium" || value === "high";
}

const key = (style: string) => style.trim().toLowerCase();

function dedupe(styles: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const style of styles) {
    const k = key(style);
    if (k.length === 0 || seen.has(k)) continue;
    seen.add(k);
    out.push(style.trim());
  }
  return out;
}
