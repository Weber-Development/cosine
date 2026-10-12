import { normalize, tokenize, wordSpans } from "./tokenize";

function matches(word: string, terms: string[]): boolean {
  const w = normalize(word);
  return terms.some((t) => w === t || (t.length >= 3 && w.startsWith(t)));
}

/**
 * Picks the window of `text` with the most query words and marks them. Falls back to the start
 * of the text when no word matches (a purely semantic hit).
 */
export function makeSnippet(
  text: string,
  query: string,
  length = 180,
): { snippet: string; highlights: Array<[number, number]> } {
  const terms = [...new Set(tokenize(query))];
  const words = wordSpans(text);
  const hits = terms.length ? words.filter((w) => matches(w.word, terms)) : [];

  let start = 0;
  if (hits.length && text.length > length) {
    // The window starting a little before a hit that covers the most hits.
    let best = 0;
    for (const hit of hits) {
      const from = Math.max(0, hit.start - 30);
      const count = hits.filter((h) => h.start >= from && h.end <= from + length).length;
      if (count > best) {
        best = count;
        start = from;
      }
    }
    // Start at a word boundary.
    if (start > 0) {
      const next = words.find((w) => w.start >= start);
      start = next ? next.start : start;
    }
  }
  let end = Math.min(text.length, start + length);
  if (end < text.length) {
    const lastSpace = text.lastIndexOf(" ", end);
    if (lastSpace > start + length / 2) end = lastSpace;
  }
  const prefix = start > 0 ? "… " : "";
  const suffix = end < text.length ? " …" : "";
  const body = text.slice(start, end).replace(/\s+/g, " ");
  const snippet = prefix + body + suffix;

  const highlights: Array<[number, number]> = [];
  if (terms.length) {
    for (const w of wordSpans(body)) {
      if (matches(w.word, terms)) highlights.push([prefix.length + w.start, prefix.length + w.end]);
    }
  }
  return { snippet, highlights };
}

/** Splits a snippet into plain and highlighted parts, e.g. for rendering `<mark>`. */
export function highlightParts(
  snippet: string,
  highlights: Array<[number, number]>,
): Array<{ text: string; match: boolean }> {
  const parts: Array<{ text: string; match: boolean }> = [];
  let pos = 0;
  for (const [s, e] of highlights) {
    if (s > pos) parts.push({ text: snippet.slice(pos, s), match: false });
    parts.push({ text: snippet.slice(s, e), match: true });
    pos = e;
  }
  if (pos < snippet.length) parts.push({ text: snippet.slice(pos), match: false });
  return parts;
}
