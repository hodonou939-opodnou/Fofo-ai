import fr from "@/messages/fr.json";
import fon from "@/messages/fon.json";
import type { Locale } from "./config";

const catalogs = { fr, fon } as const;

export function getMessages(locale: Locale) {
  return catalogs[locale];
}

export function isFonComplete(): boolean {
  return catalogs.fon.__complete === true;
}
