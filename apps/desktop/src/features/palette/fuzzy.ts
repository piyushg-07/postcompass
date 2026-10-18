/**
 * Small fuzzy matcher for the command palette. Every query character must appear in order;
 * matches at the start, at word starts and in a row score higher.
 * Returns `null` when the text doesn't match.
 */
export function fuzzyScore(query: string, text: string): number | null {
  const phrase = query.toLowerCase().trim().replace(/\s+/g, " ");
  const q = phrase.replaceAll(" ", "");
  if (!q) return 0;
  const t = text.toLowerCase();

  // The exact phrase (spaces included) beats everything, earlier is better: "back up" → "Back up …"
  const phraseIndex = t.indexOf(phrase);
  if (phraseIndex >= 0) return 2000 - phraseIndex * 2 - (t.length - phrase.length) * 0.1;

  // Then the letters without spaces: "backup" → "pg_backup"
  const index = t.indexOf(q);
  if (index >= 0) return 1000 - index * 2 - (t.length - q.length) * 0.1;

  let score = 0;
  let ti = 0;
  let previous = -2;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found < 0) return null;
    const atWordStart = found === 0 || /[\s._\-/(]/.test(t[found - 1]!);
    score += found === previous + 1 ? 8 : atWordStart ? 6 : 1;
    previous = found;
    ti = found + 1;
  }
  // Letters scattered across a long label (one here, one there) aren't a real match
  if (score < q.length * 4) return null;
  return score - t.length * 0.05;
}
