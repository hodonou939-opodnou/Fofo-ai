"use client";

import { useEffect, useState } from "react";
import Button, { buttonClasses } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import Field, { controlClasses } from "@/components/ui/field";
import Spinner from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import type { Track } from "@/lib/tracks/types";

type ShareResponse = { shareToken: string | null; url: string | null };

async function setSharing(trackId: string, enabled: boolean): Promise<Response> {
  return fetch(`/api/generations/${trackId}/share`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
}

// One tap on "Partager" turns sharing on and shows the link straight away.
export default function ShareDialog({
  track,
  onChange,
  onClose,
}: {
  track: Track;
  onChange: (track: Track) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await setSharing(track.id, true);
        if (cancelled) return;
        if (!res.ok) {
          setError(
            res.status === 409
              ? "Ce morceau n'est pas encore prêt à être partagé."
              : "Impossible de créer le lien. Réessaie."
          );
          return;
        }
        const body = (await res.json()) as ShareResponse;
        setUrl(body.url);
        onChange({ ...track, shareToken: body.shareToken });
      } catch {
        if (!cancelled) setError("Connexion perdue — réessaie.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- create the link once per opening
  }, [track.id]);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.show("Lien copié", "success");
    } catch {
      toast.show("Copie impossible — sélectionne le lien pour le copier.", "error");
    }
  }

  async function stop() {
    setStopping(true);
    try {
      const res = await setSharing(track.id, false);
      if (!res.ok) {
        setError("Impossible d'arrêter le partage. Réessaie.");
        return;
      }
      onChange({ ...track, shareToken: null });
      toast.show("Partage arrêté");
      onClose();
    } catch {
      setError("Connexion perdue — réessaie.");
    } finally {
      setStopping(false);
    }
  }

  const whatsapp = url ? `https://wa.me/?text=${encodeURIComponent(`Écoute ma création sur Fofo AI : ${url}`)}` : "#";

  return (
    <Dialog open title="Partager" onClose={onClose}>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {!url && !error && (
        <p className="flex items-center gap-2 text-sm text-dust">
          <Spinner className="size-4" /> Création du lien…
        </p>
      )}
      {url && (
        <div className="flex flex-col gap-4">
          <Field label="Lien de partage" hint="Toute personne qui a ce lien peut écouter ce morceau.">
            {(props) => (
              <input {...props} readOnly value={url} onFocus={(e) => e.target.select()} className={controlClasses} />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => void copy()}>Copier le lien</Button>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClasses("ghost", "md")}>
              Envoyer sur WhatsApp
            </a>
          </div>
          <button
            type="button"
            onClick={() => void stop()}
            disabled={stopping}
            className="self-start text-sm text-dust underline-offset-4 hover:text-danger hover:underline disabled:opacity-50"
          >
            Arrêter le partage
          </button>
        </div>
      )}
    </Dialog>
  );
}
