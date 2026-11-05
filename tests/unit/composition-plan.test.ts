import { describe, expect, it } from "vitest";
import {
  buildComposition,
  enforcePlan,
  type CompositionPlan,
  type PlanChunk,
} from "@/lib/generation/composition-plan";
import { DURATIONS, type DurationSeconds } from "@/lib/generation/options";
import { RHYTHM_STYLES } from "@/lib/generation/rhythm-styles";

function compose(durationSeconds: DurationSeconds = 30, rhythmSlug = "tchinkounme") {
  return buildComposition({
    rhythmSlug,
    rhythmName: "Tchinkounmè",
    userIdea: "Une fête de village au coucher du soleil",
    mood: "Festif",
    energy: "Élevée",
    durationSeconds,
  });
}

const lower = (styles: string[]) => styles.map((s) => s.toLowerCase());

describe("buildComposition — the skeleton plan Fofo controls", () => {
  it.each(DURATIONS)("splits a %i s track into sections that add up exactly, each within ElevenLabs' 3–120 s", (seconds) => {
    const { skeleton } = compose(seconds);
    const total = skeleton.chunks.reduce((sum, c) => sum + c.duration_ms, 0);
    expect(total).toBe(seconds * 1000);
    for (const chunk of skeleton.chunks) {
      expect(chunk.duration_ms).toBeGreaterThanOrEqual(3000);
      expect(chunk.duration_ms).toBeLessThanOrEqual(120_000);
      expect(Number.isInteger(chunk.duration_ms)).toBe(true);
    }
  });

  it("gives every section a bracketed name and no lyrics", () => {
    for (const seconds of DURATIONS) {
      for (const chunk of compose(seconds).skeleton.chunks) {
        expect(chunk.text).toMatch(/^\[[A-Za-z ]+\]$/);
      }
    }
  });

  it("opens with the rhythm's identity, instruments, tempo and feel, then the mood and energy (first chunk sets the tone)", () => {
    const style = RHYTHM_STYLES.tchinkounme;
    const first = compose().skeleton.chunks[0].positive_styles;
    expect(first[0]).toBe(style.identity);
    expect(first).toEqual(expect.arrayContaining([...style.positive]));
    expect(first).toContain(`${style.bpm} BPM`);
    expect(first).toContain(style.feel);
    expect(first).toContain("festive mood");
    expect(first).toContain("high energy");
    expect(first.length).toBeGreaterThanOrEqual(7);
  });

  it("repeats the identity, tempo and feel in every later section so the groove cannot drift", () => {
    const style = RHYTHM_STYLES.toba;
    const { skeleton } = compose(60, "toba");
    expect(skeleton.chunks.length).toBeGreaterThan(1);
    for (const chunk of skeleton.chunks.slice(1)) {
      expect(chunk.positive_styles).toEqual(
        expect.arrayContaining([style.identity, `${style.bpm} BPM`, style.feel])
      );
    }
  });

  it("has a profile for each of the three launch rhythms", () => {
    expect(Object.keys(RHYTHM_STYLES).sort()).toEqual(["tchinkounme", "toba", "zinli"]);
  });

  it("gives Zinli its measured tempo but no meter, since the recordings could not settle it", () => {
    const first = compose(30, "zinli").skeleton.chunks[0].positive_styles;
    expect(first).toContain("95 BPM");
    expect(first.some((s) => /\d+\/\d+|ternary|binary/i.test(s))).toBe(false);
  });

  it("excludes vocals and generic Western or electronic production in every section", () => {
    for (const chunk of compose(60).skeleton.chunks) {
      expect(lower(chunk.negative_styles)).toEqual(
        expect.arrayContaining(["vocals", "singing", "lyrics", "drum kit", "synthesizer", "electric guitar", "afrobeats"])
      );
    }
  });

  it("adds the rhythm's own exclusions", () => {
    const style = RHYTHM_STYLES.tchinkounme;
    for (const chunk of compose().skeleton.chunks) {
      expect(chunk.negative_styles).toEqual(expect.arrayContaining([...style.negative]));
    }
  });

  it("stays within ElevenLabs' 50 styles per list", () => {
    for (const seconds of DURATIONS) {
      for (const chunk of compose(seconds).skeleton.chunks) {
        expect(chunk.positive_styles.length).toBeLessThanOrEqual(50);
        expect(chunk.negative_styles.length).toBeLessThanOrEqual(50);
      }
    }
  });

  it("falls back to a generic profile named after the rhythm when Fofo has no profile for it", () => {
    const { skeleton } = buildComposition({
      rhythmSlug: "agbadja",
      rhythmName: "Agbadja",
      userIdea: "x",
      mood: "Paisible",
      energy: "Faible",
      durationSeconds: 15,
    });
    const first = skeleton.chunks[0].positive_styles;
    expect(first[0]).toBe("traditional Agbadja rhythm from Benin");
    expect(first.some((s) => /BPM/.test(s))).toBe(false);
    expect(lower(skeleton.chunks[0].negative_styles)).toContain("vocals");
  });

  it("hands the planner the user's idea with the instruction to keep Fofo's rhythm and exclusions", () => {
    const { idea } = compose();
    expect(idea).toContain("Une fête de village au coucher du soleil");
    expect(idea).toMatch(/keep/i);
    expect(idea).toMatch(/instrumental/i);
  });
});

describe("enforcePlan — what Fofo keeps from the planner's version", () => {
  const skeleton = compose(30).skeleton;

  function candidateFrom(base: CompositionPlan, change: (chunk: PlanChunk, i: number) => Partial<PlanChunk> = () => ({})) {
    return {
      chunks: base.chunks.map((c, i) => ({
        ...c,
        positive_styles: [...c.positive_styles],
        negative_styles: [...c.negative_styles],
        conditioning_ref: null,
        condition_strength: null,
        ...change(c, i),
      })),
    };
  }

  it("keeps Fofo's styles first and adds the planner's idea-specific styles after them", () => {
    const candidate = candidateFrom(skeleton, (c) => ({
      positive_styles: ["sunset village gathering atmosphere", ...c.positive_styles],
    }));
    const plan = enforcePlan(skeleton, candidate);
    plan.chunks.forEach((chunk, i) => {
      expect(chunk.positive_styles.slice(0, skeleton.chunks[i].positive_styles.length)).toEqual(
        skeleton.chunks[i].positive_styles
      );
      expect(chunk.positive_styles).toContain("sunset village gathering atmosphere");
      // no duplicates once the planner echoes Fofo's own styles
      expect(new Set(lower(chunk.positive_styles)).size).toBe(chunk.positive_styles.length);
    });
  });

  it("drops planner styles that would bring back voices, Western instruments, electronic production or another tempo", () => {
    const banned = [
      "soulful male vocals",
      "call and response chanting",
      "warm synth pads",
      "punchy drum kit",
      "festive Afrobeat groove",
      "electric guitar riffs",
      "128 BPM",
      "4/4 time",
    ];
    const plan = enforcePlan(
      skeleton,
      candidateFrom(skeleton, (c) => ({ positive_styles: [...banned, "earthy hand-played textures", ...c.positive_styles] }))
    );
    for (const chunk of plan.chunks) {
      for (const style of banned) expect(chunk.positive_styles).not.toContain(style);
      expect(chunk.positive_styles).toContain("earthy hand-played textures");
    }
  });

  it("keeps only section names and {directions} from the planner's text, never lyric lines", () => {
    const plan = enforcePlan(
      skeleton,
      candidateFrom(skeleton, (c, i) => ({
        text: i === 0 ? "[Opening]\n{water drums enter one by one}\nWe dance tonight under the moon\n(ooh)" : c.text,
      }))
    );
    expect(plan.chunks[0].text).toBe(`${skeleton.chunks[0].text}\n{water drums enter one by one}`);
    expect(plan.chunks[1].text).toBe(skeleton.chunks[1].text);
  });

  it("merges the planner's exclusions with Fofo's, without excluding anything Fofo asks for", () => {
    const identity = skeleton.chunks[0].positive_styles[0];
    const plan = enforcePlan(
      skeleton,
      candidateFrom(skeleton, () => ({ negative_styles: ["muddy low end", identity] }))
    );
    for (const [i, chunk] of plan.chunks.entries()) {
      expect(chunk.negative_styles).toEqual(expect.arrayContaining(skeleton.chunks[i].negative_styles));
      expect(chunk.negative_styles).toContain("muddy low end");
      expect(chunk.negative_styles).not.toContain(identity);
    }
  });

  it("caps both style lists at 50", () => {
    const many = Array.from({ length: 80 }, (_, n) => `texture ${n}`);
    const plan = enforcePlan(
      skeleton,
      candidateFrom(skeleton, () => ({ positive_styles: many, negative_styles: many }))
    );
    for (const chunk of plan.chunks) {
      expect(chunk.positive_styles.length).toBe(50);
      expect(chunk.negative_styles.length).toBe(50);
    }
  });

  it("never passes an audio reference through", () => {
    const plan = enforcePlan(
      skeleton,
      candidateFrom(skeleton, () => ({ conditioning_ref: { song_id: "x", range: { start_ms: 0, end_ms: 3000 } } } as never))
    );
    for (const chunk of plan.chunks) expect(chunk).not.toHaveProperty("conditioning_ref");
  });

  it("keeps a valid context adherence and defaults anything else to high", () => {
    const plan = enforcePlan(
      skeleton,
      candidateFrom(skeleton, (_, i) => ({ context_adherence: (i === 0 ? "medium" : "extreme") as never }))
    );
    expect(plan.chunks[0].context_adherence).toBe("medium");
    expect(plan.chunks[1].context_adherence).toBe("high");
  });

  it.each([
    ["not an object", "nope"],
    ["no chunks", {}],
    ["chunks not a list", { chunks: "x" }],
    ["a different number of sections", { chunks: [skeleton.chunks[0]] }],
    ["different section lengths", candidateFrom(skeleton, (c, i) => ({ duration_ms: c.duration_ms + (i === 0 ? 1000 : -1000) }))],
    ["an audio-reference chunk", { chunks: [{ song_id: "x", range: { start_ms: 0, end_ms: 6000 } }, skeleton.chunks[1]] }],
    ["styles that are not strings", candidateFrom(skeleton, () => ({ positive_styles: [42] as never }))],
  ])("falls back to Fofo's skeleton when the planner returns %s", (_, candidate) => {
    expect(enforcePlan(skeleton, candidate)).toEqual(skeleton);
  });
});
