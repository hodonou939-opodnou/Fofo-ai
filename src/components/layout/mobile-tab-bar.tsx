"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive } from "@/components/layout/site-header";

const ICONS = {
  create: <path d="M10 4v12M4 10h12" strokeLinecap="round" />,
  library: <path d="M4 4h3v12H4zM9 4h3v12H9zM14 5l2.5-.5 2 11-2.5.5z" strokeLinejoin="round" />,
  rhythms: (
    <>
      <circle cx="10" cy="10" r="2" />
      <circle cx="10" cy="10" r="5" />
      <circle cx="10" cy="10" r="8" />
    </>
  ),
  account: (
    <>
      <circle cx="10" cy="7" r="3.2" />
      <path d="M3.5 17c1.2-3 3.6-4.5 6.5-4.5s5.3 1.5 6.5 4.5" strokeLinecap="round" />
    </>
  ),
};

// Bottom tabs on phones (hidden from md up, where the header carries the nav).
export default function MobileTabBar({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname() ?? "/";
  const tabs = [
    { href: signedIn ? "/studio" : "/#creer", match: "/studio", label: "Créer", icon: ICONS.create },
    { href: "/bibliotheque", match: "/bibliotheque", label: "Bibliothèque", icon: ICONS.library },
    { href: "/rythmes", match: "/rythmes", label: "Rythmes", icon: ICONS.rhythms },
    { href: signedIn ? "/compte" : "/connexion", match: "/compte", label: "Compte", icon: ICONS.account },
  ];

  return (
    <>
      <div aria-hidden className="h-16 md:hidden" />
      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ember bg-night/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid h-16 grid-cols-4">
          {tabs.map((t) => {
            const active = isActive(pathname, t.match);
            return (
              <li key={t.label}>
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex h-full flex-col items-center justify-center gap-1 text-[11px]",
                    active ? "text-gold-light" : "text-dust",
                  ].join(" ")}
                >
                  <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                    {t.icon}
                  </svg>
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
