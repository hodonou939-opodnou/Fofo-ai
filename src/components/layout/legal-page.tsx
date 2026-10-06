import type { ReactNode } from "react";

export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 pt-12 pb-16 md:px-6">
      <h1 className="font-display text-5xl text-ivory md:text-6xl">{title}</h1>
      <p className="mt-6 rounded-tile border border-gold/30 bg-soot px-4 py-3 text-sm text-dust">
        Version préliminaire — ce document sera revu par un professionnel du droit avant le lancement public.
      </p>
      <div className="mt-8 flex flex-col gap-5 text-base leading-relaxed text-ivory/90">{children}</div>
    </main>
  );
}
