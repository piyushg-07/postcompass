import { cn, Select } from "@repo/ui";
import { BarChart3, LineChart } from "lucide-react";
import { useMemo, useState } from "react";
import { chartPoints, isNumeric, MAX_POINTS } from "./chart-data";

const compact = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * A quick chart of a result, like Supabase's Chart tab: a column for the X axis, a number
 * column for the Y axis, as bars or a line.
 */
export function ChartView({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | null)[][];
}) {
  const numeric = useMemo(
    () => columns.map((_, i) => isNumeric(rows, i)),
    [columns, rows],
  );
  const firstNumber = numeric.findIndex(Boolean);
  const [x, setX] = useState(() => {
    const label = numeric.findIndex((n) => !n);
    return label >= 0 ? label : 0;
  });
  const [y, setY] = useState(() =>
    firstNumber >= 0 && firstNumber !== x
      ? firstNumber
      : numeric.findIndex((n, i) => n && i !== 0),
  );
  const [kind, setKind] = useState<"bar" | "line">("bar");
  const [hover, setHover] = useState<number | null>(null);

  if (firstNumber < 0)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-xs text-fg-muted">
        <BarChart3 className="size-5 text-fg-subtle" />
        Charts need at least one number column in the result.
      </div>
    );

  // The picked column may stop being numeric when the same query is run again
  const yCol = y >= 0 && numeric[y] ? y : firstNumber;
  const points = chartPoints(rows, x, yCol);
  let max = 0;
  let min = 0;
  for (const p of points) {
    max = Math.max(max, p.value);
    min = Math.min(min, p.value);
  }
  const span = max - min || 1;
  const height = (v: number) => ((v - min) / span) * 100;
  const zero = height(0);
  const shown = points[hover ?? -1];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3 text-xs">
        <span className="text-fg-subtle">X axis</span>
        <Select
          size="sm"
          mono
          className="w-40"
          value={String(x)}
          onValueChange={(v) => setX(Number(v))}
          options={columns.map((c, i) => ({ value: String(i), label: c }))}
        />
        <span className="ml-2 text-fg-subtle">Y axis</span>
        <Select
          size="sm"
          mono
          className="w-40"
          value={String(yCol)}
          onValueChange={(v) => setY(Number(v))}
          options={columns
            .map((c, i) => ({ value: String(i), label: c }))
            .filter((_, i) => numeric[i])}
        />
        <div className="ml-2 flex rounded-control border border-border p-0.5">
          {(["bar", "line"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-label={k === "bar" ? "Bar chart" : "Line chart"}
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                "flex h-6 w-7 cursor-pointer items-center justify-center rounded [&_svg]:size-3.5",
                kind === k
                  ? "bg-surface-hover text-fg"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              {k === "bar" ? <BarChart3 /> : <LineChart />}
            </button>
          ))}
        </div>
        <span className="ml-auto truncate text-fg-subtle">
          {shown ? (
            <>
              <span className="font-mono text-fg">{shown.label}</span>:{" "}
              <span className="font-mono text-accent">
                {shown.value.toLocaleString()}
              </span>
            </>
          ) : rows.length > MAX_POINTS ? (
            `Showing the first ${MAX_POINTS} rows`
          ) : null}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 gap-2 p-4">
        {/* Y axis */}
        <div className="flex w-12 shrink-0 flex-col justify-between pb-6 text-right font-mono text-[10px] text-fg-subtle">
          <span>{compact.format(max)}</span>
          <span>{compact.format((max + min) / 2)}</span>
          <span>{compact.format(min)}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="relative min-h-0 flex-1 border-b border-l border-border"
            onMouseLeave={() => setHover(null)}
          >
            {kind === "bar" ? (
              <div
                className={cn(
                  "absolute inset-0 flex items-stretch px-1",
                  points.length <= 60 ? "gap-1.5" : "gap-px",
                )}
              >
                {points.map((p, i) => {
                  const top = Math.max(height(p.value), zero);
                  const bottom = Math.min(height(p.value), zero);
                  return (
                    <div
                      key={i}
                      className="relative min-w-0 flex-1"
                      onMouseEnter={() => setHover(i)}
                    >
                      <div
                        className={cn(
                          "absolute inset-x-0 rounded-t-sm",
                          hover === i ? "bg-accent" : "bg-accent/60",
                        )}
                        style={{
                          bottom: `${bottom}%`,
                          height: `${top - bottom}%`,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                <svg
                  className="absolute inset-0 h-full w-full overflow-visible"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <polyline
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                    points={points
                      .map(
                        (p, i) =>
                          `${points.length === 1 ? 50 : (i / (points.length - 1)) * 100},${100 - height(p.value)}`,
                      )
                      .join(" ")}
                  />
                </svg>
                <div className="absolute inset-0 flex">
                  {points.map((_, i) => (
                    <div
                      key={i}
                      className={cn("flex-1", hover === i && "bg-accent/10")}
                      onMouseEnter={() => setHover(i)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          {/* X axis: first, middle and last labels */}
          <div className="flex h-6 shrink-0 items-end justify-between gap-2 font-mono text-[10px] text-fg-subtle">
            <span className="truncate">{points[0]?.label}</span>
            {points.length > 2 && (
              <span className="truncate">
                {points[Math.floor(points.length / 2)]?.label}
              </span>
            )}
            {points.length > 1 && (
              <span className="truncate">{points.at(-1)?.label}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
