// How each rhythm is described to the music model, in English (ElevenLabs
// styles must be English; spec §8: nothing is ever composed in Fon). Two
// sources only, so nothing is invented:
//   - the product owner's spreadsheet "Liste_Rythmes_Tchinkoume_Toba_Zinli_Artistes.xlsx"
//     (region, instruments, history — also in migration 0006);
//   - measurements of the owner's 60 reference recordings (2026-11-05: tempo,
//     binary vs ternary pulse, where the energy sits in the spectrum). Facts
//     only: the recordings themselves are never used for training (no licence).
// Every descriptor is to be confirmed by ear by the product owner.
export type RhythmStyle = {
  identity: string; // the first style of the plan: what the track is
  positive: readonly string[]; // instruments, sound, context — most important first
  negative: readonly string[]; // this rhythm's own exclusions (common ones live in composition-plan.ts)
  bpm?: number;
  feel?: string;
};

// "12/8 ternary feel" alone came back binary (measured): spelled out.
const TERNARY = "12/8 time signature, triplet swing: every beat divided in three";

export const RHYTHM_STYLES: Readonly<Record<string, RhythmStyle>> = {
  tchinkounme: {
    identity: "traditional Tchinkounme rhythm of the Mahi people of Savalou, Benin",
    positive: [
      // spreadsheet: "percussions aquatiques (tohoun) + gota (gourde)"
      "water drums: half calabashes floating upside down in basins of water, deep round wet thuds",
      "gota gourd percussion",
      "acoustic village percussion ensemble",
      // measured: the darkest of the three (median spectral centroid ~730 Hz). A first
      // "deep low end" style made the model all bass (centroid 114 Hz): ask for clarity instead.
      "crisp hand-struck attacks with clear mid-range detail",
      "live outdoor acoustic recording",
    ],
    // Stan Tohon's electrified "Tchink System" is the modern descendant, not the target.
    negative: ["funk band", "straight 4/4 rock beat", "straight eighth notes"],
    // measured: Alokpon and Gbètchéou recordings, 10 of 11 ternary, 108–123 BPM, median 112
    bpm: 112,
    feel: TERNARY,
  },
  zinli: {
    identity: "traditional Zinli rhythm of the Fon royal court of Abomey, Benin",
    positive: [
      // spreadsheet: "Instrument principal : kpézin (jarre)"
      "kpezin clay jar drum with a deep resonant tone",
      // spreadsheet: royal funeral origin, renewed as festive music by Alèkpéhanhou
      "stately ceremonial groove rooted in royal funeral music",
      "acoustic percussion ensemble",
      // measured: the most bass-heavy of the three, yet still ~790 Hz centroid; "heavy low end"
      // made the model all bass (centroid 102 Hz): ask for clarity instead.
      "crisp hand-struck attacks with clear mid-range detail",
      "live acoustic recording",
    ],
    negative: [],
    // measured: Alèkpéhanhou 91–94 BPM, the 20 recordings median 98.5. Binary or
    // slow ternary could not be told apart from the recordings: no meter imposed.
    bpm: 95,
  },
  toba: {
    identity: "traditional Toba rhythm of central and southern Benin, with Yoruba-Nago influence",
    positive: [
      // spreadsheet names no instrument for Toba
      "West African hand drum ensemble",
      // spreadsheet: once played by moonlight to pass on tales; weddings, festivities
      "evokes moonlit village storytelling gatherings",
      "danceable celebration rhythm for weddings and festivities",
      // measured: the brightest of the three (median spectral centroid ~1190 Hz)
      "bright mid-range percussion with crisp attacks",
      "live acoustic recording",
    ],
    negative: ["straight 4/4 rock beat", "straight eighth notes"],
    // measured: the masters' recordings (Allèvi, Gbèzé) are ternary, 96–115 BPM, median 103;
    // the binary ones are mostly church "Toba hanyé" adaptations.
    bpm: 104,
    feel: TERNARY,
  },
};

// A rhythm added later without a profile still gets its name and the common
// exclusions, but no tempo or meter Fofo has not measured.
export function rhythmStyle(slug: string, rhythmName: string): RhythmStyle {
  return (
    RHYTHM_STYLES[slug] ?? {
      identity: `traditional ${rhythmName} rhythm from Benin`,
      positive: ["acoustic West African percussion ensemble", "live acoustic recording"],
      negative: [],
    }
  );
}
