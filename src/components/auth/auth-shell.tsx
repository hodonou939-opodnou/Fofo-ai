import type { ReactNode } from "react";
import Cover from "@/components/brand/cover";

// Shared frame for the account pages: the form on the right, and on larger
// screens one of the rhythm covers on the left as a quiet reminder of why.
export default function AuthShell({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:px-6 md:py-20">
      <div className="hidden md:block">
        <Cover slug="zinli" seed="auth" className="aspect-[4/5] w-full rounded-panel shadow-lift" />
      </div>
      <div className="w-full max-w-md justify-self-center md:justify-self-start">
        <h1 className="font-display text-5xl text-ivory md:text-6xl">{title}</h1>
        {intro && <div className="mt-4 text-dust">{intro}</div>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-8 flex flex-col gap-3 text-sm">{footer}</div>}
      </div>
    </main>
  );
}
