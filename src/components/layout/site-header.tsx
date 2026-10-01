import Image from "next/image";
import Link from "next/link";
import LanguageSwitcher from "@/components/layout/language-switcher";

export default function SiteHeader({ activeLocale }: { activeLocale: "fr" | "fon" }) {
  return (
    <header className="flex items-center justify-between px-6 py-4">
      <Link href="/" className="flex items-center gap-2" aria-label="Fofo AI">
        <Image src="/brand/logo-symbol.png" alt="" width={32} height={32} />
        <span className="font-semibold text-lg">Fofo AI</span>
      </Link>
      <nav className="flex items-center gap-4" data-active-locale={activeLocale}>
        <LanguageSwitcher activeLocale={activeLocale} />
        <Link
          href="/studio"
          className="rounded-full bg-[var(--color-gold-start)] px-4 py-2 text-sm font-medium text-[var(--color-ink)]"
        >
          Créer ma musique
        </Link>
      </nav>
    </header>
  );
}
