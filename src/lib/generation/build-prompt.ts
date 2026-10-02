export function buildPrompt(params: {
  rhythmName: string;
  userIdea: string;
  mood: string;
  energy: string;
}): string {
  const { rhythmName, userIdea, mood, energy } = params;
  return (
    `Instrumental track inspired by the ${rhythmName} rhythm from Benin. ${userIdea}. ` +
    `Mood: ${mood}. Energy level: ${energy}. Percussion-forward, original composition, no vocals, no lyrics.`
  );
}
