import { describe, expect, it } from "vitest";
import { masters, resolveSameArtist } from "@/lib/rhythms/references";
import type { RhythmReference } from "@/lib/rhythms/queries";

const ref = (id: string, artist: string, videoUrl: string | null = null): RhythmReference => ({
  id,
  artist,
  role: `rôle ${id}`,
  style: null,
  knownWorks: null,
  videoUrl,
});

// The spreadsheet marks a second video of the row above with "(même artiste)":
// a note for its reader, not part of the artist's name.
const zinli = [
  ref("a", "Alèkpéhanhou (Michel Loucou / Claude Michel Loucou)", "https://www.youtube.com/@leroialekpehanhou/videos"),
  ref("b", "Alekpehanhou (même artiste)", "https://www.youtube.com/watch?v=MU_n-NoGkKM"),
  ref("c", "Kesse / Adize / Zondo"),
];

describe("resolveSameArtist", () => {
  it("credits a '(même artiste)' row to the artist of the row above", () => {
    const resolved = resolveSameArtist(zinli);
    expect(resolved[1].artist).toBe("Alèkpéhanhou (Michel Loucou / Claude Michel Loucou)");
    expect(resolved[1].videoUrl).toBe("https://www.youtube.com/watch?v=MU_n-NoGkKM");
  });

  it("leaves every other row exactly as the source wrote it", () => {
    const resolved = resolveSameArtist(zinli);
    expect(resolved[0]).toEqual(zinli[0]);
    expect(resolved[2]).toEqual(zinli[2]);
  });
});

describe("masters", () => {
  it("lists each master once, without the extra-video rows", () => {
    expect(masters(zinli).map((r) => r.id)).toEqual(["a", "c"]);
  });
});
