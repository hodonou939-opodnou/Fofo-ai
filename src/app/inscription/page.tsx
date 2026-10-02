import Link from "next/link";
import SignUpForm from "@/components/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <main className="px-6 py-12">
      <h1 className="text-2xl font-semibold mb-6">Crée ton compte Fofo AI</h1>
      <SignUpForm />
      <p className="mt-4 text-sm max-w-sm">
        <Link href="/connexion" className="underline">
          Déjà un compte ? Se connecter
        </Link>
      </p>
    </main>
  );
}
