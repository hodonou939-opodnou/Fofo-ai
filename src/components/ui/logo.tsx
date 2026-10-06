import Image from "next/image";

// The Fofo mark is a black "f" note on cream, so on the dark site it sits on
// its own cream tile — the brand's allowed background — like an app icon.
export default function Logo({ withName = true, size = 36 }: { withName?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="grid place-items-center overflow-hidden rounded-[10px] bg-paper ring-1 ring-gold/30"
        style={{ width: size, height: size }}
      >
        <Image
          src="/brand/logo-symbol.png"
          alt=""
          width={size}
          height={size}
          className="h-[86%] w-auto object-contain"
          priority
        />
      </span>
      {withName && <span className="font-display text-2xl tracking-tight text-ivory">Fofo AI</span>}
    </span>
  );
}
