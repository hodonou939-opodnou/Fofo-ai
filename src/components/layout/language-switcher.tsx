"use client";

import { isFonComplete } from "@/lib/i18n/get-messages";
import type { Locale } from "@/lib/i18n/config";

export default function LanguageSwitcher({ activeLocale }: { activeLocale: Locale }) {
  const fonAvailable = isFonComplete();

  return (
    <div className="flex gap-2 text-sm" role="group" aria-label="Langue">
      <button type="button" aria-pressed={activeLocale === "fr"}>
        Français
      </button>
      {fonAvailable && (
        <button type="button" aria-pressed={activeLocale === "fon"}>
          Fon
        </button>
      )}
    </div>
  );
}
