"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import Field, { controlClasses } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import ShareDialog from "@/components/tracks/share-dialog";
import { isTerminal, type Track } from "@/lib/tracks/types";

const TITLE_MAX = 80;
const TITLE_ERROR = `Le titre doit faire entre 1 et ${TITLE_MAX} caractères.`;

type Panel = "share" | "rename" | "delete" | null;

export default function TrackMenu({
  track,
  onChange,
  onRemoved,
}: {
  track: Track;
  onChange: (track: Track) => void;
  onRemoved: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const ref = useRef<HTMLDivElement>(null);
  const completed = track.status === "completed";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openPanel(next: Panel) {
    setOpen(false);
    setPanel(next);
  }

  const itemClass = "block w-full rounded-tile px-3 py-2.5 text-left text-sm text-ivory hover:bg-soot-raised";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Options : ${track.title}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid size-10 place-items-center rounded-full bg-night/70 text-ivory backdrop-blur transition hover:bg-night"
      >
        <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
          <circle cx="4.5" cy="10" r="1.6" fill="currentColor" />
          <circle cx="10" cy="10" r="1.6" fill="currentColor" />
          <circle cx="15.5" cy="10" r="1.6" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-52 rounded-panel border border-ember bg-soot p-1.5 shadow-lift">
          {completed && (
            <button type="button" className={itemClass} onClick={() => openPanel("share")}>
              Partager
            </button>
          )}
          {completed && (
            <a href={`/api/audio/${track.id}?download=1`} className={itemClass} onClick={() => setOpen(false)}>
              Télécharger
            </a>
          )}
          <button type="button" className={itemClass} onClick={() => openPanel("rename")}>
            Renommer
          </button>
          {isTerminal(track.status) && (
            <button type="button" className={`${itemClass} text-danger`} onClick={() => openPanel("delete")}>
              Supprimer
            </button>
          )}
        </div>
      )}

      {panel === "share" && <ShareDialog track={track} onChange={onChange} onClose={() => setPanel(null)} />}
      {panel === "rename" && <RenameDialog track={track} onChange={onChange} onClose={() => setPanel(null)} />}
      {panel === "delete" && <DeleteDialog track={track} onRemoved={onRemoved} onClose={() => setPanel(null)} />}
    </div>
  );
}

function RenameDialog({ track, onChange, onClose }: { track: Track; onChange: (t: Track) => void; onClose: () => void }) {
  const [title, setTitle] = useState(track.title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function save() {
    const trimmed = title.trim();
    if (trimmed.length < 1 || trimmed.length > TITLE_MAX) {
      setError(TITLE_ERROR);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/generations/${track.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (res.status === 400) {
        setError(TITLE_ERROR);
        return;
      }
      if (!res.ok) {
        setError("Impossible de renommer. Réessaie.");
        return;
      }
      const body = (await res.json()) as { title: string };
      onChange({ ...track, title: body.title });
      toast.show("Titre modifié", "success");
      onClose();
    } catch {
      setError("Connexion perdue — réessaie.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open title="Renommer" onClose={onClose}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="flex flex-col gap-5"
      >
        <Field label="Titre" error={error}>
          {(props) => (
            <input
              {...props}
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              className={controlClasses}
            />
          )}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={saving}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function DeleteDialog({ track, onRemoved, onClose }: { track: Track; onRemoved: (id: string) => void; onClose: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/generations/${track.id}`, { method: "DELETE" });
      if (res.status === 409) {
        setError("Ce morceau est encore en cours de création.");
        return;
      }
      if (!res.ok) {
        setError("Impossible de supprimer. Réessaie.");
        return;
      }
      onRemoved(track.id);
      toast.show("Morceau supprimé");
      onClose();
    } catch {
      setError("Connexion perdue — réessaie.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open title="Supprimer ce morceau ?" onClose={onClose}>
      <p className="text-sm leading-relaxed text-dust">
        « {track.title} » et son lien de partage seront effacés définitivement.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="danger" loading={deleting} onClick={() => void remove()}>
          Supprimer définitivement
        </Button>
      </div>
    </Dialog>
  );
}
