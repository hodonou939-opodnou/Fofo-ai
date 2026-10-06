"use client";

import { isFonComplete } from "@/lib/i18n/get-messages";
import type { Locale } from "@/lib/i18n/config";

// Fon stays "bientôt disponible" until a native speaker supplies
// messages/fon.json — Fon interface text is never machine-generated.
export default function LanguageSwitcher({ activeLocale }: { activeLocale: Locale }) {
  const fonAvailable = isFonComplete();

  return (
    <div className="flex items-center gap-2 text-sm" role="group" aria-label="Langue">
      <button
        type="button"
        aria-pressed={activeLocale === "fr"}
        className="rounded-full border border-gold/50 px-3 py-1.5 text-gold-light aria-[pressed=false]:border-ember aria-[pressed=false]:text-dust"
      >
        Français
      </button>
      {fonAvailable ? (
        <button
          type="button"
          aria-pressed={activeLocale === "fon"}
          className="rounded-full border border-ember px-3 py-1.5 text-dust aria-[pressed=true]:border-gold/50 aria-[pressed=true]:text-gold-light"
        >
          Fon
        </button>
      ) : (
        <span className="rounded-full border border-dashed border-ember px-3 py-1.5 text-dust" title="Traduction en cours par un locuteur natif">
          Fon — bientôt disponible
        </span>
      )}
    </div>
  );
}
