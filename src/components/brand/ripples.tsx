// The Tchinkounmè water-ripple motif at hero scale: concentric gold rings that
// fade outwards, drawn once behind the home creation box.
export default function Ripples({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1000 1000" className={className} aria-hidden>
      <defs>
        <radialGradient id="ripples-fade" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-gold-light)" stopOpacity="1" />
          <stop offset="70%" stopColor="var(--color-gold)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--color-bronze)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g fill="none" stroke="url(#ripples-fade)">
        {Array.from({ length: 14 }, (_, i) => (
          <circle key={i} cx="500" cy="500" r={40 + i * 34 + i * i * 0.9} strokeWidth={2.2 - i * 0.12} />
        ))}
      </g>
    </svg>
  );
}
