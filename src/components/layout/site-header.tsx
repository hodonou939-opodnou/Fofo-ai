"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/ui/logo";
import Button from "@/components/ui/button";
import AccountMenu from "@/components/layout/account-menu";

export type HeaderUser = { email: string } | null;

const SECTIONS = [
  { href: "/rythmes", label: "Rythmes" },
  { href: "/studio", label: "Studio" },
  { href: "/bibliotheque", label: "Bibliothèque" },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteHeader({ user }: { user: HeaderUser }) {
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-40 border-b border-ember/60 bg-night/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 md:px-6">
        <Link href="/" aria-label="Fofo AI — accueil" className="shrink-0">
          <Logo />
        </Link>

        <nav aria-label="Principale" className="hidden items-center gap-1 md:flex">
          {SECTIONS.map((s) => {
            const active = isActive(pathname, s.href);
            return (
              <Link
                key={s.href}
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "rounded-full px-3.5 py-2 text-sm transition",
                  active ? "bg-soot-raised text-ivory" : "text-dust hover:text-ivory",
                ].join(" ")}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <AccountMenu email={user.email} />
          ) : (
            <Link href="/connexion" className="rounded-full px-3.5 py-2 text-sm text-ivory hover:text-gold-light">
              Se connecter
            </Link>
          )}
          <Button href={user ? "/studio" : "/#creer"} size="sm" className="hidden sm:inline-flex">
            Créer ma musique
          </Button>
        </div>
      </div>
    </header>
  );
}
