"use client";

import { useState } from "react";

const MOODS = ["Festif", "Énergique", "Paisible", "Émouvant", "Cinématographique"];
const ENERGIES = ["Faible", "Modérée", "Élevée"];
const DURATIONS = [15, 30, 60];

export default function GenerationForm({
  rhythms,
  onJobCreated,
}: {
  rhythms: { slug: string; name: string }[];
  onJobCreated: (jobId: string) => void;
}) {
  const [rhythmSlug, setRhythmSlug] = useState(rhythms[0]?.slug ?? "");
  const [prompt, setPrompt] = useState("");
  const [mood, setMood] = useState(MOODS[0]);
  const [energy, setEnergy] = useState(ENERGIES[0]);
  const [durationSeconds, setDurationSeconds] = useState(DURATIONS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rhythmSlug, prompt, mood, energy, durationSeconds }),
      });
      if (res.status === 429) {
        setError("Tu as atteint la limite de générations par heure. Réessaie plus tard.");
        return;
      }
      if (!res.ok) {
        setError("Impossible de lancer la génération. Réessaie.");
        return;
      }
      const { jobId } = await res.json();
      onJobCreated(jobId);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <label className="flex flex-col gap-1">
        Rythme
        <select
          value={rhythmSlug}
          onChange={(e) => setRhythmSlug(e.target.value)}
          className="border rounded px-3 py-2"
        >
          {rhythms.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Décris ton idée
        <textarea
          required
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        Humeur
        <select value={mood} onChange={(e) => setMood(e.target.value)} className="border rounded px-3 py-2">
          {MOODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Énergie
        <select
          value={energy}
          onChange={(e) => setEnergy(e.target.value)}
          className="border rounded px-3 py-2"
        >
          {ENERGIES.map((en) => (
            <option key={en} value={en}>
              {en}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Durée
        <select
          value={durationSeconds}
          onChange={(e) => setDurationSeconds(Number(e.target.value))}
          className="border rounded px-3 py-2"
        >
          {DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d}s
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-[var(--color-gold-start)] px-4 py-2 font-medium disabled:opacity-50"
      >
        {submitting ? "Lancement…" : "Générer"}
      </button>
    </form>
  );
}
