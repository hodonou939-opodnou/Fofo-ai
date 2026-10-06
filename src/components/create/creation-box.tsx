"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import Button from "@/components/ui/button";
import Chip from "@/components/ui/chip";
import Select from "@/components/ui/select";
import {
  DURATIONS,
  ENERGIES,
  MOODS,
  PROMPT_MAX_LENGTH,
  type DurationSeconds,
  type Energy,
  type Mood,
} from "@/lib/generation/options";
import { clearDraft, loadDraft, saveDraft, type Draft } from "@/lib/studio/draft";

const ERROR_MESSAGES: Partial<Record<number, string>> = {
  429: "Tu as atteint la limite de générations par heure. Réessaie plus tard.",
  503: "Le service de génération est momentanément indisponible.",
};
const GENERIC_ERROR = "Impossible de lancer la génération. Réessaie.";
const NETWORK_ERROR = "Connexion perdue — réessaie.";
const EMPTY_IDEA = "Décris ton idée en quelques mots.";
const SIGN_UP_PATH = "/inscription?next=/studio";
const SIGN_IN_PATH = "/connexion?next=/studio";

export type RhythmOption = { slug: string; name: string };

// The one place a creation starts — on the home page for visitors (their idea
// is kept through sign-up, nothing is generated) and in the Studio for members.
export default function CreationBox({
  rhythms,
  mode,
  initialRhythm,
  initialDraft,
  onCreated,
}: {
  rhythms: RhythmOption[];
  mode: "guest" | "signed-in";
  initialRhythm?: string;
  /** Pre-fills the box, e.g. with a failed track's idea on "Réessayer" (remount with a new key). */
  initialDraft?: Draft;
  onCreated?: (jobId: string, draft: Draft) => void;
}) {
  const router = useRouter();
  const ideaId = useId();
  const statusId = useId();
  const wantedRhythm = initialDraft?.rhythmSlug ?? initialRhythm;
  const firstRhythm =
    (wantedRhythm && rhythms.some((r) => r.slug === wantedRhythm) && wantedRhythm) || rhythms[0]?.slug || "";

  const [rhythmSlug, setRhythmSlug] = useState(firstRhythm);
  const [prompt, setPrompt] = useState(initialDraft?.prompt ?? "");
  const [mood, setMood] = useState<Mood>(initialDraft?.mood ?? "Festif");
  const [energy, setEnergy] = useState<Energy>(initialDraft?.energy ?? "Modérée");
  const [durationSeconds, setDurationSeconds] = useState<DurationSeconds>(initialDraft?.durationSeconds ?? 30);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  // Set only while the last attempt got no HTTP response at all: resubmitting
  // is then a retry of that same submission, which the server dedupes.
  const unconfirmedSubmissionId = useRef<string | null>(null);

  // A member arriving from sign-up gets back the idea they typed as a guest.
  useEffect(() => {
    if (mode !== "signed-in") return;
    const draft = loadDraft();
    if (!draft) return;
    clearDraft();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of browser-only state after hydration
    setPrompt(draft.prompt);
    if (rhythms.some((r) => r.slug === draft.rhythmSlug)) setRhythmSlug(draft.rhythmSlug);
    setMood(draft.mood);
    setEnergy(draft.energy);
    setDurationSeconds(draft.durationSeconds);
  }, [mode, rhythms]);

  function currentDraft(): Draft {
    return { prompt: prompt.trim(), rhythmSlug, mood, energy, durationSeconds };
  }

  function goToAccount(path: string) {
    saveDraft(currentDraft());
    router.push(path);
  }

  async function submit() {
    setError(null);
    setStatus("");
    if (!prompt.trim()) {
      setError(EMPTY_IDEA);
      return;
    }
    if (mode === "guest") {
      goToAccount(SIGN_UP_PATH);
      return;
    }

    setSubmitting(true);
    const draft = currentDraft();
    const submissionId = unconfirmedSubmissionId.current ?? crypto.randomUUID();

    let res: Response;
    try {
      res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, submissionId }),
      });
    } catch {
      unconfirmedSubmissionId.current = submissionId;
      setError(NETWORK_ERROR);
      setSubmitting(false);
      return;
    }

    // The server answered: the next click is a new, deliberate submission.
    unconfirmedSubmissionId.current = null;
    try {
      if (!res.ok) {
        setError(ERROR_MESSAGES[res.status] ?? GENERIC_ERROR);
        return;
      }
      const { jobId } = await res.json();
      setStatus("Création lancée — elle apparaît dans tes créations.");
      onCreated?.(jobId, draft);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  const remaining = PROMPT_MAX_LENGTH - prompt.length;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="rounded-panel border border-gold/35 bg-soot/90 p-4 text-left shadow-glow backdrop-blur sm:p-5"
    >
      <label htmlFor={ideaId} className="sr-only">
        Décris ton idée
      </label>
      <textarea
        id={ideaId}
        value={prompt}
        maxLength={PROMPT_MAX_LENGTH}
        rows={3}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder="Décris ton idée… une fête de village au coucher du soleil, une veillée douce, l'entrée des mariés…"
        aria-describedby={statusId}
        aria-invalid={error === EMPTY_IDEA ? true : undefined}
        className="w-full resize-none bg-transparent text-lg leading-relaxed text-ivory placeholder:text-dust/70 focus:outline-none sm:text-xl"
      />
      {remaining <= 100 && <p className="text-right text-xs text-dust">{remaining} caractères restants</p>}

      <div role="group" aria-label="Rythme" className="mt-3 flex flex-wrap gap-2">
        {rhythms.map((r) => (
          <Chip key={r.slug} selected={r.slug === rhythmSlug} onClick={() => setRhythmSlug(r.slug)}>
            {r.name}
          </Chip>
        ))}
      </div>

      {/* Phones: mood on its own row so no option label gets cut off. */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <Select
          className="col-span-2 sm:col-span-1"
          label="Ambiance"
          value={mood}
          onChange={(v) => setMood(v as Mood)}
          options={MOODS.map((m) => ({ value: m, label: m }))}
        />
        <Select
          label="Énergie"
          value={energy}
          onChange={(v) => setEnergy(v as Energy)}
          options={ENERGIES.map((en) => ({ value: en, label: en }))}
        />
        <Select
          label="Durée"
          value={String(durationSeconds)}
          onChange={(v) => setDurationSeconds(Number(v) as DurationSeconds)}
          options={DURATIONS.map((d) => ({ value: String(d), label: `${d} s` }))}
        />
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        {mode === "guest" ? (
          <button
            type="button"
            onClick={() => goToAccount(SIGN_IN_PATH)}
            className="min-h-11 text-sm text-dust underline-offset-4 hover:text-ivory hover:underline"
          >
            J&apos;ai déjà un compte
          </button>
        ) : (
          <p id={statusId} aria-live="polite" className="text-sm text-dust">
            {status}
          </p>
        )}
        <Button type="submit" size="lg" loading={submitting}>
          Générer
        </Button>
      </div>
      {mode === "guest" && (
        <p id={statusId} className="mt-3 text-xs text-dust">
          Crée ton compte gratuit pour lancer la création — ton idée est gardée.
        </p>
      )}
    </form>
  );
}
