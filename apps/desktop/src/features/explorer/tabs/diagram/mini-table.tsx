import type { MiniMapNodeProps } from "@xyflow/react";
import { createContext, useContext } from "react";

/** Lets minimap tables report hovers to the diagram (they're rendered by React Flow). */
export const MiniHover = createContext<(name: string | null) => void>(() => {});

/**
 * A table in the minimap: a tiny card with a header strip (accent when focused, blue for views)
 * and the table name. Hovering shows the name in the minimap header and focuses the table.
 */
export function MiniTable({ id, x, y, width, height, color }: MiniMapNodeProps) {
  const setHover = useContext(MiniHover);
  const strip =
    color === "focus" ? "var(--color-accent)" : color === "view" ? "#5ea8f0" : "#4a4a4a";
  const header = Math.min(height, Math.max(14, height * 0.16));
  // Escape every other character by code, so "a b" and "a_b" get different ids
  const clip = `mini-${id.replace(/[^a-z0-9-]/gi, (c) => `_${c.charCodeAt(0)}_`)}`;
  return (
    <g
      onMouseEnter={() => setHover(id)}
      onMouseLeave={() => setHover(null)}
      style={{ cursor: "pointer" }}
    >
      <clipPath id={clip}>
        <rect x={x} y={y} width={width} height={height} rx={10} />
      </clipPath>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={10}
        fill={color === "focus" ? "color-mix(in srgb, var(--color-accent) 14%, #1c1c1e)" : "#1c1c1e"}
        stroke={color === "focus" ? "var(--color-accent)" : "#3a3a3c"}
        strokeWidth={4}
      />
      <rect x={x} y={y} width={width} height={header} rx={10} fill={strip} />
      <text
        x={x + 16}
        y={y + header + 58}
        fontSize={52}
        fontFamily="'Source Code Pro Variable', monospace"
        fill={color === "focus" ? "var(--color-accent)" : "#bdbdbd"}
        clipPath={`url(#${clip})`}
      >
        {id}
      </text>
    </g>
  );
}
