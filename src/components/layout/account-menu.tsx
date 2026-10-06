"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function AccountMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    await createBrowserSupabaseClient().auth.signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  const initial = email.trim().charAt(0).toUpperCase() || "?";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Mon compte"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid size-10 place-items-center rounded-full border border-gold/40 bg-soot-raised text-sm font-semibold text-gold-light transition hover:border-gold"
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-panel border border-ember bg-soot p-2 shadow-lift">
          <p className="truncate px-3 py-2 text-xs text-dust">{email}</p>
          <Link href="/compte" onClick={() => setOpen(false)} className="block rounded-tile px-3 py-2.5 text-sm text-ivory hover:bg-soot-raised">
            Mon compte
          </Link>
          <Link href="/bibliotheque" onClick={() => setOpen(false)} className="block rounded-tile px-3 py-2.5 text-sm text-ivory hover:bg-soot-raised">
            Ma bibliothèque
          </Link>
          <button type="button" onClick={signOut} className="block w-full rounded-tile px-3 py-2.5 text-left text-sm text-ivory hover:bg-soot-raised">
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
