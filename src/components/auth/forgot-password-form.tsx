"use client";

import { useState } from "react";
import Button from "@/components/ui/button";
import Field, { controlClasses } from "@/components/ui/field";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

function messageFor(error: { message?: string; status?: number }) {
  if (error.status === 429 || /rate limit/i.test(error.message ?? "")) {
    return "Trop de demandes. Réessaie dans quelques minutes.";
  }
  return "Impossible d'envoyer l'e-mail pour le moment. Réessaie plus tard.";
}

// Sends the reset link. The link comes back to /auth/confirm, which opens a
// recovery session and continues to /nouveau-mot-de-passe. Errors are shown,
// never hidden behind a "sent" message.
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error } = await createBrowserSupabaseClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/confirm?next=/nouveau-mot-de-passe`,
      });
      if (error) {
        setError(messageFor(error));
        return;
      }
      setSent(true);
    } catch {
      setError("Connexion perdue — réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <p role="status" className="rounded-panel border border-gold/30 bg-soot p-5 text-ivory">
        Si un compte existe pour {email}, un lien vient d&apos;être envoyé. Ouvre-le sur cet appareil — et pense à
        vérifier tes spams.
      </p>
    );
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
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={submitting}>
        Envoyer le lien
      </Button>
    </form>
  );
}
