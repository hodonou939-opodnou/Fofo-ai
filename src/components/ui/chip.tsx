import type { ReactNode } from "react";

export default function Chip({
  selected,
  onClick,
  children,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={[
        "min-h-11 rounded-full border px-4 text-sm transition",
        selected
          ? "border-gold bg-gold/15 text-gold-light"
          : "border-ember bg-soot-raised text-ivory hover:border-gold/50",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
