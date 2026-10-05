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
   * so results show up while the user is still typing.
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
      if (isLast && token.length >= 2) {
        for (const term of this.prefixed(token)) if (term !== token) add(term, 0.6);
      }
    });
    return [...scores]
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score || a.id - b.id)
      .slice(0, limit);
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
