import type { RhythmReference } from "@/lib/rhythms/queries";

// The product owner's spreadsheet marks a second video of the artist in the
// row above with "(même artiste)" — a note for the sheet's reader, not part of
// the artist's name. The data stays verbatim; only its display follows the note.
const SAME_ARTIST = /\(même artiste\)\s*$/i;

function isSameArtistRow(ref: RhythmReference) {
  return SAME_ARTIST.test(ref.artist.normalize("NFC"));
}

// Credits each "(même artiste)" row to the artist of the row above it.
export function resolveSameArtist(references: RhythmReference[]): RhythmReference[] {
  return references.map((ref, i) => {
    const previous = references[i - 1];
    return isSameArtistRow(ref) && previous ? { ...ref, artist: previous.artist } : ref;
  });
}

// Each master once: the "(même artiste)" rows only add a video.
export function masters(references: RhythmReference[]): RhythmReference[] {
  return references.filter((ref) => !isSameArtistRow(ref));
}
