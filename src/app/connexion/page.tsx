import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/auth/auth-shell";
import SignInForm from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Connexion" };

type Props = { searchParams: Promise<{ next?: string; erreur?: string }> };

export default async function SignInPage({ searchParams }: Props) {
  const { next, erreur } = await searchParams;
  const withNext = (path: string) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);

  return (
    <AuthShell
      title="Bon retour"
      intro="Connecte-toi pour retrouver tes créations."
      footer={
        <>
          <Link href="/mot-de-passe-oublie" className="text-dust hover:text-ivory">
            Mot de passe oublié ?
          </Link>
          <Link href={withNext("/inscription")} className="text-dust hover:text-ivory">
            Pas encore de compte ? <span className="text-gold-light">Créer un compte</span>
          </Link>
        </>
      }
    >
      {erreur === "lien" && (
        <p role="alert" className="mb-5 rounded-tile border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          Ce lien n&apos;est plus valide. Demande un nouveau lien.
        </p>
      )}
      <SignInForm next={next} />
    </AuthShell>
  );
}
