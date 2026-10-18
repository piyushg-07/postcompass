import { useId } from "react";

/**
 * Compi, the PostCompass mascot: a little compass that floats, blinks and waves.
 * `sleepy` closes its eyes and floats some z's (used when no database is running).
 */
export function Mascot({
  size = 200,
  mood = "happy",
}: {
  size?: number;
  mood?: "happy" | "sleepy";
}) {
  const id = useId();
  const glow = `${id}-glow`;
  const body = `${id}-body`;
  const sleepy = mood === "sleepy";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      role="img"
      aria-label="Compi, the PostCompass mascot"
    >
      <defs>
        <radialGradient id={glow} cx="50%" cy="50%" r="50%">
          <stop
            offset="0%"
            stopColor="#3ecf8e"
            stopOpacity={sleepy ? 0.12 : 0.28}
          />
          <stop offset="100%" stopColor="#3ecf8e" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1c1c1c" />
          <stop offset="100%" stopColor="#0b0b0b" />
        </linearGradient>
      </defs>

      {/* Soft emerald glow */}
      <circle
        className="pc-glow"
        cx="100"
        cy="104"
        r="92"
        fill={`url(#${glow})`}
      />

      {/* Twinkles */}
      {!sleepy && (
        <g fill="#3ecf8e">
          <path
            className="pc-twinkle"
            d="M34 52l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"
          />
          <path
            className="pc-twinkle"
            style={{ animationDelay: "1s" }}
            d="M166 40l1.5 4.5 4.5 1.5-4.5 1.5-1.5 4.5-1.5-4.5-4.5-1.5 4.5-1.5z"
          />
          <path
            className="pc-twinkle"
            style={{ animationDelay: "2s" }}
            d="M170 138l1.5 4.5 4.5 1.5-4.5 1.5-1.5 4.5-1.5-4.5-4.5-1.5 4.5-1.5z"
          />
        </g>
      )}

      {/* Ground shadow (shrinks as Compi floats up) */}
      <ellipse
        className="pc-shadow"
        cx="100"
        cy="182"
        rx="40"
        ry="5"
        fill="#000"
      />

      <g className="pc-float">
        {/* Needle on top, swaying like an antenna */}
        <g className="pc-sway">
          <path d="M100 18 L108 44 L92 44 Z" fill="#3ecf8e" />
          <path d="M92 44 L108 44 L100 52 Z" fill="#ededed" />
        </g>

        {/* Waving arm */}
        {!sleepy && (
          <g className="pc-wave">
            <path
              d="M152 112 C 164 104, 168 92, 166 82"
              stroke="#2e2e2e"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <circle cx="166" cy="80" r="6" fill="#ededed" />
          </g>
        )}
        {/* Resting arm */}
        <path
          d="M48 116 C 40 122, 38 132, 42 140"
          stroke="#2e2e2e"
          strokeWidth="7"
          strokeLinecap="round"
        />

        {/* Body: a compass face */}
        <circle
          cx="100"
          cy="108"
          r="58"
          fill={`url(#${body})`}
          stroke="#2e2e2e"
          strokeWidth="3"
        />
        <circle
          cx="100"
          cy="108"
          r="47"
          stroke="#1f1f1f"
          strokeWidth="1.5"
          strokeDasharray="2 6"
        />
        {/* N / E / S / W ticks */}
        <g stroke="#3a3a3a" strokeWidth="3" strokeLinecap="round">
          <path d="M100 54 V61" />
          <path d="M100 155 V162" />
          <path d="M46 108 H53" />
          <path d="M147 108 H154" />
        </g>
        <text
          x="100"
          y="72"
          textAnchor="middle"
          fontSize="9"
          fontWeight="700"
          fill="#3ecf8e"
          fontFamily="var(--font-sans)"
        >
          N
        </text>

        {/* Face */}
        {sleepy ? (
          <g stroke="#ededed" strokeWidth="3" strokeLinecap="round">
            <path d="M74 104 Q 81 109 88 104" />
            <path d="M112 104 Q 119 109 126 104" />
          </g>
        ) : (
          <g className="pc-blink">
            <ellipse cx="81" cy="102" rx="6.5" ry="8.5" fill="#ededed" />
            <ellipse cx="119" cy="102" rx="6.5" ry="8.5" fill="#ededed" />
            <circle cx="83" cy="99" r="2" fill="#020202" />
            <circle cx="121" cy="99" r="2" fill="#020202" />
          </g>
        )}
        {/* Cheeks */}
        <circle cx="70" cy="118" r="6" fill="#3ecf8e" opacity="0.22" />
        <circle cx="130" cy="118" r="6" fill="#3ecf8e" opacity="0.22" />
        {/* Mouth */}
        {sleepy ? (
          <ellipse cx="100" cy="126" rx="4" ry="3" fill="#2e2e2e" />
        ) : (
          <path
            d="M88 122 Q 100 134 112 122"
            stroke="#ededed"
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
      </g>

      {/* Sleepy z's */}
      {sleepy && (
        <g fill="#a1a1a1" fontFamily="var(--font-sans)" fontWeight="700">
          <text className="pc-zzz" x="140" y="62" fontSize="14">
            z
          </text>
          <text
            className="pc-zzz"
            style={{ animationDelay: "1s" }}
            x="150"
            y="50"
            fontSize="17"
          >
            z
          </text>
          <text
            className="pc-zzz"
            style={{ animationDelay: "2s" }}
            x="160"
            y="38"
            fontSize="20"
          >
            z
          </text>
        </g>
      )}
    </svg>
  );
}

/** Emerald data streams flowing towards the mascot (decorative). */
export function DataStreams({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 220"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden
    >
      {[
        "M0 40 C 120 40, 200 90, 330 110",
        "M0 110 C 140 110, 220 110, 330 112",
        "M0 180 C 120 180, 200 130, 330 114",
      ].map((d, i) => (
        <g key={d}>
          <path d={d} stroke="#3ecf8e" strokeOpacity="0.07" strokeWidth="1.5" />
          <path
            className="pc-stream"
            style={{ animationDelay: `${i * 0.5}s` }}
            d={d}
            stroke="#3ecf8e"
            strokeOpacity="0.6"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>
      ))}
    </svg>
  );
}
