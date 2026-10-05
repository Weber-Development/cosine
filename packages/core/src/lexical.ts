import { tokenize } from "./tokenize";

export interface LexicalHit {
  id: number;
  score: number;
}

/** BM25 over chunk texts. Built in the browser from the chunks, so it is not stored in the index. */
export class LexicalIndex {
  private readonly postings = new Map<string, Array<[id: number, tf: number]>>();
  private readonly lengths: number[] = [];
  private readonly avgLength: number;
  private readonly terms: string[];

  constructor(
    texts: string[],
    private readonly k1 = 1.2,
    private readonly b = 0.75,
  ) {
    let total = 0;
    texts.forEach((text, id) => {
      const tokens = tokenize(text);
      this.lengths[id] = tokens.length;
      total += tokens.length;
      const counts = new Map<string, number>();
      for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
      for (const [term, tf] of counts) {
        let list = this.postings.get(term);
        if (!list) {
          list = [];
          this.postings.set(term, list);
        }
        list.push([id, tf]);
      }
    });
    this.avgLength = texts.length ? total / texts.length : 0;
    this.terms = [...this.postings.keys()].sort();
  }

  get size(): number {
    return this.lengths.length;
  }

  /**
   * Ranks chunks for `query`. The last word also matches as a prefix (`instal` finds `install`),
   * so results show up while the user is still typing. A word that is not in the index matches
   * close spellings (`instalation` finds `installation`) at a lower weight.
   */
  search(query: string, limit = 20): LexicalHit[] {
    const tokens = tokenize(query);
    if (!tokens.length) return [];
    const scores = new Map<number, number>();
    const n = this.size;
    const add = (term: string, factor: number) => {
      const list = this.postings.get(term);
      if (!list) return;
      const idf = Math.log(1 + (n - list.length + 0.5) / (list.length + 0.5));
      for (const [id, tf] of list) {
        const len = this.lengths[id] ?? 0;
        const norm = tf + this.k1 * (1 - this.b + (this.b * len) / (this.avgLength || 1));
        const s = (idf * tf * (this.k1 + 1)) / norm;
        scores.set(id, (scores.get(id) ?? 0) + s * factor);
      }
    };
    const unique = [...new Set(tokens)];
    unique.forEach((token, i) => {
      add(token, 1);
      const isLast = i === unique.length - 1 && query.trimEnd().length === query.length;
      let prefixed: string[] = [];
      if (isLast && token.length >= 2) {
        prefixed = this.prefixed(token).filter((term) => term !== token);
        for (const term of prefixed) add(term, 0.6);
      }
      if (!this.postings.has(token) && !prefixed.length) {
        for (const term of this.similar(token)) add(term, 0.5);
      }
    });
    return [...scores]
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score || a.id - b.id)
      .slice(0, limit);
  }

  /** Terms within edit distance 1 (2 from eight letters on) of a word that is not in the index. */
  private similar(word: string, max = 5): string[] {
    if (word.length < 4) return [];
    const limit = word.length >= 8 ? 2 : 1;
    const found: Array<[term: string, distance: number]> = [];
    for (const term of this.terms) {
      if (Math.abs(term.length - word.length) > limit) continue;
      const distance = editDistance(word, term, limit);
      if (distance <= limit) found.push([term, distance]);
    }
    return found
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .slice(0, max)
      .map(([term]) => term);
  }

  private prefixed(prefix: string, max = 30): string[] {
    // Binary search for the first term >= prefix in the sorted term list.
    let lo = 0;
    let hi = this.terms.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((this.terms[mid] as string) < prefix) lo = mid + 1;
      else hi = mid;
    }
    const out: string[] = [];
    for (let i = lo; i < this.terms.length && out.length < max; i++) {
      const term = this.terms[i] as string;
      if (!term.startsWith(prefix)) break;
      out.push(term);
    }
    return out;
  }
}

/**
 * Optimal string alignment distance (Levenshtein plus swapped neighbours), cut off above `limit`:
 * returns `limit + 1` as soon as the distance is known to be larger.
 */
export function editDistance(a: string, b: string, limit = Number.POSITIVE_INFINITY): number {
  if (a === b) return 0;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(
        (prev[j] as number) + 1,
        (row[j - 1] as number) + 1,
        (prev[j - 1] as number) + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, (prev2[j - 2] as number) + 1);
      }
      row[j] = d;
      if (d < best) best = d;
    }
    if (best > limit) return limit + 1;
    prev2 = prev;
    prev = row;
  }
  return prev[b.length] as number;
}
