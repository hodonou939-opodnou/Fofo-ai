"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import Field, { controlClasses } from "@/components/ui/field";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function SignInForm({ next }: { next?: string }) {
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
      const { error } = await createBrowserSupabaseClient().auth.signInWithPassword({ email, password });
      if (error) {
        setError("E-mail ou mot de passe incorrect.");
        return;
      }
      router.push(safeNextPath(next));
      router.refresh();
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
      <Field label="Mot de passe">
        {(props) => (
          <input
            {...props}
            type="password"
            required
            autoComplete="current-password"
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
        Me connecter
      </Button>
    </form>
  );
}
