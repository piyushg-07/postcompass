import { useId } from "react";

/**
 * The PostCompass mark (same drawing as app-icon.svg), inline so the needle and glow follow the
 * chosen accent color. app-icon.svg stays the source for the OS icons.
 */
export function Logo({ size = 32, title }: { size?: number; title?: string }) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      className="shrink-0 text-accent"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#161616" />
          <stop offset="1" stopColor="#050505" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="45%" r="55%">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="32" y="32" width="960" height="960" rx="216" fill={`url(#${id}-tile)`} />
      <rect x="32" y="32" width="960" height="960" rx="216" fill={`url(#${id}-glow)`} />
      <rect x="34" y="34" width="956" height="956" rx="214" fill="none" stroke="#2a2a2a" strokeWidth="4" />
      <circle cx="512" cy="512" r="330" fill="none" stroke="#3a3a3a" strokeWidth="40" />
      <g stroke="#555" strokeWidth="28" strokeLinecap="round">
        <line x1="512" y1="214" x2="512" y2="250" />
        <line x1="512" y1="774" x2="512" y2="810" />
        <line x1="214" y1="512" x2="250" y2="512" />
        <line x1="774" y1="512" x2="810" y2="512" />
      </g>
      <path d="M512 196 L604 512 L420 512 Z" fill="currentColor" />
      <path d="M420 512 L604 512 L512 828 Z" fill="#ededed" />
      <circle cx="512" cy="512" r="38" fill="#0a0a0a" />
    </svg>
  );
}
