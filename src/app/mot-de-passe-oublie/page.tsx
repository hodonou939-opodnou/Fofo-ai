"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.resetPasswordForEmail(email);
    setSent(true);
  }

  return (
    <main className="px-6 py-12">
      <h1 className="text-2xl font-semibold mb-6">Mot de passe oublié</h1>
      {sent ? (
        <p>Si un compte existe pour cet e-mail, un lien de réinitialisation a été envoyé.</p>
      ) : (
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
          <button type="submit" className="rounded-full bg-[var(--color-gold-start)] px-4 py-2">
            Envoyer le lien
          </button>
        </form>
      )}
    </main>
  );
}
