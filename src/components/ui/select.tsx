"use client";

import Field, { controlClasses } from "@/components/ui/field";

export type SelectOption = { value: string; label: string };

// Native select (best on phones), styled to match the other controls.
export default function Select({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Field label={label} className={className}>
      {(props) => (
        <div className="relative">
          <select
            {...props}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`${controlClasses} appearance-none pr-10`}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-dust"
          >
            <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </div>
      )}
    </Field>
  );
}
