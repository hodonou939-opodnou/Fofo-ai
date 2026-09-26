import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="px-6 py-8 text-sm text-[var(--color-ink)]/70">
      <nav className="flex gap-4">
        <Link href="/confidentialite">Confidentialité</Link>
        <Link href="/cgu">Conditions générales</Link>
      </nav>
      <p className="mt-2">© {new Date().getFullYear()} Fofo AI.</p>
    </footer>
  );
}
