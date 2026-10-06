import type { Metadata } from "next";
import AuthShell from "@/components/auth/auth-shell";
import NewPasswordForm from "@/components/auth/new-password-form";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

// Reached from the reset link (via /auth/confirm, which opened a recovery
// session); the proxy sends anyone without a session to sign-in.
export default function NewPasswordPage() {
  return (
    <AuthShell title="Nouveau mot de passe" intro="Choisis ton nouveau mot de passe.">
      <NewPasswordForm />
    </AuthShell>
  );
}
