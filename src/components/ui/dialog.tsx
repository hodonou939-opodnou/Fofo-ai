"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

// Accessible modal: labelled, Escape and backdrop close it, focus moves in on
// open and back to the trigger on close. On phones it docks as a bottom sheet.
export default function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      "input, textarea, select, button:not([data-dialog-close]), a[href]"
    );
    (focusable ?? panelRef.current)?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-night/75 backdrop-blur-sm" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
        className="relative w-full max-w-md rounded-t-panel border border-ember bg-soot p-6 shadow-lift sm:rounded-panel"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold text-ivory">
            {title}
          </h2>
          <button
            type="button"
            data-dialog-close
            onClick={onClose}
            aria-label="Fermer"
            className="-m-2 grid size-10 place-items-center rounded-full text-dust hover:bg-soot-raised hover:text-ivory"
          >
            <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
              <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
