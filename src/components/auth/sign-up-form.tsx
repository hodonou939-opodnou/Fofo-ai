"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(
        error.message.includes("already registered")
          ? "Un compte existe déjà avec cet e-mail."
          : "Impossible de créer le compte. Réessaie."
      );
      return;
    }
    // When email confirmation is required, Supabase returns no error for an
    // already-registered, already-confirmed email — only a user with an empty
    // identities array (to prevent email enumeration). Treat that the same as
    // the explicit "already registered" error above.
    if (data.user && data.user.identities?.length === 0) {
      setError("Un compte existe déjà avec cet e-mail.");
      return;
    }
    router.push("/studio");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <label className="flex flex-col gap-1">
        E-mail
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        Mot de passe
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </label>
      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="rounded-full bg-[var(--color-gold-start)] px-4 py-2 font-medium"
      >
        Créer mon compte
      </button>
    </form>
  );
}
