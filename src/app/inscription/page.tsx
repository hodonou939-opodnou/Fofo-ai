import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/auth/auth-shell";
import SignUpForm from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Créer un compte" };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function SignUpPage({ searchParams }: Props) {
  const { next } = await searchParams;

  return (
    <AuthShell
      title="Crée ton compte"
      intro="Gratuit. Ton idée t'attend dans le Studio dès que ton compte est prêt."
      footer={
        <>
          <Link href={next ? `/connexion?next=${encodeURIComponent(next)}` : "/connexion"} className="inline-flex min-h-11 items-center text-dust hover:text-ivory">
            Déjà un compte ? <span className="text-gold-light">Se connecter</span>
          </Link>
          <p className="text-xs text-dust">
            En créant un compte, tu acceptes les{" "}
            <Link href="/cgu" className="underline-offset-4 hover:underline">
              conditions générales
            </Link>{" "}
            et la{" "}
            <Link href="/confidentialite" className="underline-offset-4 hover:underline">
              politique de confidentialité
            </Link>
            .
          </p>
        </>
      }
    >
      <SignUpForm next={next} />
    </AuthShell>
  );
}
