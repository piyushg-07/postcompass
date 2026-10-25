/** Turning a result into chart points. Pure. */

/** Points shown at most; the rest of the result is left out of the chart. */
export const MAX_POINTS = 200;
const NUMBER = /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i;

/** Whether column `col` holds numbers (NULLs and blanks aside) in the rows that are charted. */
export function isNumeric(rows: (string | null)[][], col: number) {
  let seen = false;
  for (const row of rows.slice(0, MAX_POINTS)) {
    const v = row[col];
    if (v === null || v === undefined || v === "") continue;
    if (!NUMBER.test(v.trim())) return false;
    seen = true;
  }
  return seen;
}

export interface ChartPoint {
  label: string;
  value: number;
}

/** The first `MAX_POINTS` rows as points; NULLs and out-of-range numbers (1e400) count as 0. */
export function chartPoints(
  rows: (string | null)[][],
  x: number,
  y: number,
): ChartPoint[] {
  return rows.slice(0, MAX_POINTS).map((r) => {
    const value = Number(r[y] ?? 0);
    return {
      label: r[x] ?? "NULL",
      value: Number.isFinite(value) ? value : 0,
    };
  });
}
