import Link from "next/link";
import SignInForm from "@/components/auth/sign-in-form";

export default function SignInPage() {
  return (
    <main className="px-6 py-12">
      <h1 className="text-2xl font-semibold mb-6">Connexion</h1>
      <SignInForm />
      <div className="mt-4 flex flex-col gap-1 text-sm max-w-sm">
        <Link href="/mot-de-passe-oublie" className="underline">
          Mot de passe oublié ?
        </Link>
        <Link href="/inscription" className="underline">
          Pas encore de compte ? Créer un compte
        </Link>
      </div>
    </main>
  );
}
