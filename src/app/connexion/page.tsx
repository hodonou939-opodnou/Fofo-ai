import SignInForm from "@/components/auth/sign-in-form";

export default function SignInPage() {
  return (
    <main className="px-6 py-12">
      <h1 className="text-2xl font-semibold mb-6">Connexion</h1>
      <SignInForm />
    </main>
  );
}
