import type { RhythmReference } from "@/lib/rhythms/queries";

// Composed (NFC) form for display, so Fon tone marks and French accents render
// the same whichever way the source text was encoded (spec 2026-10-06 §6).
export function display(text: string) {
  return text.normalize("NFC");
}

export default function ReferenceList({ references }: { references: RhythmReference[] }) {
  return (
    <ul aria-label="Les maîtres du rythme" className="divide-y divide-ember/70 border-y border-ember/70">
      {references.map((r) => (
        <li key={r.id} className="grid gap-1 py-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-8">
          <div>
            <p className="text-lg font-semibold text-ivory">{display(r.artist)}</p>
            {r.style && <p className="mt-1 text-sm text-gold-light">{display(r.style)}</p>}
          </div>
          <div>
            <p className="text-dust">{display(r.role)}</p>
            {r.knownWorks && <p className="mt-1 text-sm text-dust/80">{display(r.knownWorks)}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
