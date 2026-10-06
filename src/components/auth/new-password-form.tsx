"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import Field, { controlClasses } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const MIN_LENGTH = 8;

function messageFor(error: { message?: string; code?: string }) {
  if (error.code === "same_password" || /different from the old/i.test(error.message ?? "")) {
    return "Choisis un mot de passe différent de l'ancien.";
  }
  if (error.code === "weak_password") return "Ce mot de passe est trop faible. Allonge-le ou mélange les caractères.";
  if (/session/i.test(error.message ?? "")) return "Ce lien n'est plus valide. Demande un nouveau lien.";
  return "Impossible d'enregistrer le mot de passe. Réessaie.";
}

// Sets a new password for the signed-in (or recovering) user, then opens the
// Studio. Used after a reset link and on the account page.
export default function NewPasswordForm({ redirectTo = "/studio" }: { redirectTo?: string | null }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`${MIN_LENGTH} caractères minimum.`);
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await createBrowserSupabaseClient().auth.updateUser({ password });
      if (error) {
        setError(messageFor(error));
        return;
      }
      toast.show("Mot de passe enregistré", "success");
      setPassword("");
      setConfirm("");
      if (redirectTo) router.push(redirectTo);
    } catch {
      setError("Connexion perdue — réessaie.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <Field label="Nouveau mot de passe" hint={`${MIN_LENGTH} caractères minimum.`}>
        {(props) => (
          <input
            {...props}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={controlClasses}
          />
        )}
      </Field>
      <Field label="Confirme le mot de passe">
        {(props) => (
          <input
            {...props}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={controlClasses}
          />
        )}
      </Field>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={saving}>
        Enregistrer le mot de passe
      </Button>
    </form>
  );
}
