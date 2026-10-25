/** Turns catalog text (defaults, index and trigger definitions) into what the structure page shows. */

/** `'pending'::order_status` → `'pending'`; the cast only repeats the column type. */
export function tidyDefault(value: string) {
  return value.replace(/^('(?:[^']|'')*')::[\w\s."[\]]+$/, "$1");
}

/** The part of an index after `USING method`, e.g. `(placed_at DESC)`, without the brackets. */
export function indexedOn(index: { definition: string; columns: string[] }) {
  const m = /USING \S+ \((.*)\)(.*)$/i.exec(index.definition);
  if (!m) return index.columns.join(", ");
  return `${m[1]}${m[2]}`;
}

/** `CHECK ((price > 0))` → `price > 0`; other kinds as written. */
export function constraintRule(definition: string) {
  const check = /^CHECK \((.*)\)$/i.exec(definition.trim());
  if (!check) return definition;
  const inner = check[1]!;
  return inner.startsWith("(") && inner.endsWith(")")
    ? inner.slice(1, -1)
    : inner;
}

/** Pulls the timing, events and function out of a `CREATE TRIGGER` statement. */
export function parseTrigger(definition: string) {
  const m =
    /TRIGGER \S+ (BEFORE|AFTER|INSTEAD OF) (.+?) ON .+?EXECUTE (?:FUNCTION|PROCEDURE) ([^\s(]+)/i.exec(
      definition,
    );
  if (!m) return null;
  return {
    timing: m[1]!,
    events: m[2]!.split(/\s+OR\s+/i).map((e) => e.split(/\s/)[0]!),
    fn: m[3]!,
  };
}
