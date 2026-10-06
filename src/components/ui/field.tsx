"use client";

import { useId, type ReactNode } from "react";

// Shared look for text inputs, textareas and selects.
export const controlClasses =
  "w-full rounded-tile border border-ember bg-soot px-4 py-3 text-base text-ivory placeholder:text-dust/70 " +
  "transition focus:border-gold/70 focus:outline-none focus:ring-2 focus:ring-gold/25 " +
  "aria-[invalid=true]:border-danger/70";

export type ControlProps = {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

// A labelled form control with an optional hint and an announced error.
// The control itself is rendered by the caller, which receives the wiring.
export default function Field({
  label,
  hint,
  error,
  className = "",
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  children: (props: ControlProps) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-ivory">
        {label}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && (
        <p id={hintId} className="text-xs text-dust">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
