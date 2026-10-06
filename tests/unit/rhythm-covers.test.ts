import { describe, expect, it } from "vitest";
import { coverFor, variationFor } from "@/lib/design/rhythm-covers";

describe("coverFor", () => {
  it("gives each catalog rhythm its own motif drawn from the rhythm itself", () => {
    expect(coverFor("tchinkounme").motif).toBe("ripples"); // water percussion (tohoun)
    expect(coverFor("zinli").motif).toBe("vessel"); // kpézin jar
    expect(coverFor("toba").motif).toBe("moon"); // once played by moonlight
  });

  it("gives the three rhythms distinct base colours", () => {
    const bases = new Set(["tchinkounme", "zinli", "toba"].map((slug) => coverFor(slug).base));
    expect(bases.size).toBe(3);
  });

  it("falls back to a neutral cover for an unknown or missing rhythm", () => {
    expect(coverFor("inconnu").motif).toBe("neutral");
    expect(coverFor(null).motif).toBe("neutral");
  });
});

describe("variationFor", () => {
  it("is stable for the same seed so a track always keeps its cover", () => {
    expect(variationFor("job-123")).toEqual(variationFor("job-123"));
  });

  it("differs between tracks so a grid of the same rhythm is not identical", () => {
    const seeds = ["a1", "b2", "c3", "d4", "e5", "f6"];
    const rotations = new Set(seeds.map((s) => variationFor(s).rotation));
    expect(rotations.size).toBeGreaterThan(3);
  });

  it("stays inside the ranges the cover art is designed for", () => {
    for (const seed of ["x", "yy", "zzz", "a-very-long-seed-value-0123456789"]) {
      const v = variationFor(seed);
      expect(v.rotation).toBeGreaterThanOrEqual(0);
      expect(v.rotation).toBeLessThan(360);
      expect(v.offsetX).toBeGreaterThanOrEqual(-20);
      expect(v.offsetX).toBeLessThanOrEqual(20);
      expect(v.offsetY).toBeGreaterThanOrEqual(-20);
      expect(v.offsetY).toBeLessThanOrEqual(20);
    }
  });
});
