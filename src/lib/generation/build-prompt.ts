import { ENERGY_DESCRIPTORS, MOOD_DESCRIPTORS, type Energy, type Mood } from "./options";

export function buildPrompt(params: {
  rhythmName: string;
  userIdea: string;
  mood: Mood;
  energy: Energy;
}): string {
  const { rhythmName, userIdea, mood, energy } = params;
  return (
    `Instrumental track inspired by the ${rhythmName} rhythm from Benin. ${userIdea}. ` +
    `Mood: ${MOOD_DESCRIPTORS[mood]}. Energy level: ${ENERGY_DESCRIPTORS[energy]}. ` +
    `Percussion-forward, original composition, no vocals, no lyrics.`
  );
}
