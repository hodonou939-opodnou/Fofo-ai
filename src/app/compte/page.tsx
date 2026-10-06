import type { Metadata } from "next";
import NewPasswordForm from "@/components/auth/new-password-form";
import SignOutButton from "@/components/auth/sign-out-button";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-2xl px-4 pt-12 pb-16 md:px-6">
      <h1 className="font-display text-5xl text-ivory md:text-6xl">Mon compte</h1>

      <section aria-labelledby="identite" className="mt-10 rounded-panel border border-ember bg-soot p-6">
        <h2 id="identite" className="text-lg font-semibold text-ivory">
          E-mail
        </h2>
        <p className="mt-2 break-all text-dust">{user?.email}</p>
      </section>

      <section aria-labelledby="mdp" className="mt-6 rounded-panel border border-ember bg-soot p-6">
        <h2 id="mdp" className="text-lg font-semibold text-ivory">
          Changer le mot de passe
        </h2>
        <div className="mt-5">
          <NewPasswordForm redirectTo={null} />
        </div>
      </section>

      <div className="mt-8">
        <SignOutButton />
      </div>
    </main>
  );
}
