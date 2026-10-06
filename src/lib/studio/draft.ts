import { isDuration, isEnergy, isMood, type DurationSeconds, type Energy, type Mood } from "@/lib/generation/options";

// A visitor's unfinished creation, kept for the trip through sign-up
// (spec 2026-10-06 §5). sessionStorage only: it never outlives the tab.
// Every access is guarded — private modes and strict settings can throw.

export type Draft = {
  prompt: string;
  rhythmSlug: string;
  mood: Mood;
  energy: Energy;
  durationSeconds: DurationSeconds;
};

const KEY = "fofo:draft";

export function saveDraft(draft: Draft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Storage unavailable: the visitor will simply retype their idea.
  }
}

export function loadDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Draft>;
    if (
      typeof value.prompt !== "string" ||
      typeof value.rhythmSlug !== "string" ||
      !isMood(value.mood) ||
      !isEnergy(value.energy) ||
      !isDuration(value.durationSeconds)
    ) {
      return null;
    }
    return value as Draft;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
