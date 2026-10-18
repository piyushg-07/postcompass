export function CompassMark({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle
        cx="24"
        cy="24"
        r="21"
        stroke="var(--color-border-strong)"
        strokeWidth="2"
      />
      <path d="M24 9 L29 24 L24 39 L19 24 Z" fill="var(--color-fg)" />
      <path d="M24 9 L29 24 L19 24 Z" fill="var(--color-accent)" />
      <circle cx="24" cy="24" r="2.5" fill="var(--color-bg)" />
    </svg>
  );
}
