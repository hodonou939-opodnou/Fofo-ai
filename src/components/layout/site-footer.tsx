import Link from "next/link";
import Logo from "@/components/ui/logo";
import LanguageSwitcher from "@/components/layout/language-switcher";

export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-ember/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 md:flex-row md:items-start md:justify-between md:px-6">
        <div className="max-w-xs">
          <Logo size={32} />
          <p className="mt-3 text-sm leading-relaxed text-dust">
            Des musiques originales nées des rythmes du Bénin, pour celles et ceux qui veulent les faire vivre.
          </p>
        </div>
        <nav aria-label="Pied de page" className="flex flex-col gap-2.5 text-sm">
          <Link href="/rythmes" className="text-dust hover:text-ivory">
            Les rythmes
          </Link>
          <Link href="/confidentialite" className="text-dust hover:text-ivory">
            Confidentialité
          </Link>
          <Link href="/cgu" className="text-dust hover:text-ivory">
            Conditions générales
          </Link>
        </nav>
        <div className="flex flex-col gap-3">
          <LanguageSwitcher activeLocale="fr" />
          <p className="text-xs text-dust">© {new Date().getFullYear()} Fofo AI</p>
        </div>
      </div>
    </footer>
  );
}
