"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import Field, { controlClasses } from "@/components/ui/field";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const ALREADY_REGISTERED = "Un compte existe déjà avec cet e-mail.";

export default function SignUpForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data, error } = await createBrowserSupabaseClient().auth.signUp({ email, password });
      if (error) {
        setError(error.message.includes("already registered") ? ALREADY_REGISTERED : "Impossible de créer le compte. Réessaie.");
        return;
      }
      // When email confirmation is required, Supabase returns no error for an
      // already-registered, already-confirmed email — only a user with an empty
      // identities array (to prevent email enumeration). Treat that the same as
      // the explicit "already registered" error above.
      if (data.user && data.user.identities?.length === 0) {
        setError(ALREADY_REGISTERED);
        return;
      }
      router.push(safeNextPath(next));
      router.refresh?.();
    } catch {
      setError("Connexion perdue — réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field label="E-mail">
        {(props) => (
          <input
            {...props}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={controlClasses}
          />
        )}
      </Field>
      <Field label="Mot de passe" hint="8 caractères minimum.">
        {(props) => (
          <input
            {...props}
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={controlClasses}
          />
        )}
      </Field>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={submitting}>
        Créer mon compte
      </Button>
    </form>
  );
}
