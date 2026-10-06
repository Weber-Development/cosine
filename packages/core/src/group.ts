import {
  type Cosine,
  countFacets,
  type Facet,
  type FacetOptions,
  type LoadIndexOptions,
  loadIndex,
} from "./search";
import type { SearchOptions, SearchResult, SearchStatus } from "./types";

const RRF_K = 60;

/** A result of a search over several indexes. */
export interface GroupResult extends SearchResult {
  /** Position of the index in the group that produced the result. */
  index: number;
}

export interface GroupOptions {
  /** Ranking weight per index, in the order of `members`. Default 1 each. */
  weights?: number[];
}

/**
 * Searches several indexes as one, e.g. the docs, the blog and the help center, each built with
 * its own `cosine build`. Results are merged by rank, so scores of different indexes need not be
 * comparable. Has the same search methods as `Cosine`, so it also works with `<cosine-search>`.
 */
export class CosineGroup {
  private readonly weights: number[];

  constructor(
    readonly members: Cosine[],
    options: GroupOptions = {},
  ) {
    if (!members.length) throw new Error("cosine: a group needs at least one index");
    this.weights = members.map((_, i) => {
      const w = options.weights?.[i] ?? 1;
      return Number.isFinite(w) && w > 0 ? w : 1;
    });
  }

  /** All chunks of all indexes. */
  get chunks() {
    return this.members.flatMap((m) => m.chunks);
  }

  /**
   * Of the indexes that can rank semantically: `loading-model` while any loads, `ready` when all
   * are ready, `model-failed` when one failed. Keyword-only indexes do not count.
   */
  get status(): SearchStatus {
    const all = this.members.filter((m) => m.semantic).map((m) => m.status);
    if (all.includes("loading-model")) return "loading-model";
    if (all.length && all.every((s) => s === "ready")) return "ready";
    if (all.includes("model-failed")) return "model-failed";
    return "lexical";
  }

  get semantic(): boolean {
    return this.members.some((m) => m.semantic);
  }

  onStatus(listener: (status: SearchStatus) => void): () => void {
    let last = this.status;
    const offs = this.members.map((m) =>
      m.onStatus(() => {
        const now = this.status;
        if (now === last) return;
        last = now;
        listener(now);
      }),
    );
    return () => {
      for (const off of offs) off();
    };
  }

  async warmup(): Promise<void> {
    await Promise.all(this.members.map((m) => m.warmup()));
  }

  searchLexical(query: string, options: SearchOptions = {}): GroupResult[] {
    return this.merge(
      this.members.map((m) => m.searchLexical(query, { ...options, limit: this.depth(options) })),
      options,
    );
  }

  async search(query: string, options: SearchOptions = {}): Promise<GroupResult[]> {
    const lists = await Promise.all(
      this.members.map((m) => m.search(query, { ...options, limit: this.depth(options) })),
    );
    return this.merge(lists, options);
  }

  /** Counts results per section of the site across all indexes, see `Cosine#facets`. */
  async facets(query: string, options: FacetOptions = {}): Promise<Facet[]> {
    const { depth = 1, limit = 200, ...rest } = options;
    return countFacets(await this.search(query, { ...rest, limit }), depth);
  }

  private depth(options: SearchOptions): number {
    return Math.max((options.limit ?? 8) * 2, 20);
  }

  private merge(lists: SearchResult[][], options: SearchOptions): GroupResult[] {
    const limit = options.limit ?? 8;
    const best = new Map<string, GroupResult & { merged: number }>();
    lists.forEach((list, index) => {
      list.forEach((result, rank) => {
        const merged = (this.weights[index] as number) / (RRF_K + rank + 1);
        const known = best.get(result.chunk.url);
        if (!known || merged > known.merged) {
          best.set(result.chunk.url, { ...result, index, merged, score: merged });
        }
      });
    });
    return [...best.values()]
      .sort((a, b) => b.merged - a.merged || a.index - b.index)
      .slice(0, limit)
      .map(({ merged: _m, ...result }) => result);
  }
}

/**
 * Loads several indexes (URLs of `cosine-index.json`) and returns them as one group.
 *
 * ```ts
 * const cosine = await loadIndexes(["/docs/cosine-index.json", "/blog/cosine-index.json"]);
 * ```
 */
export async function loadIndexes(
  urls: Array<string | URL>,
  options: LoadIndexOptions & GroupOptions = {},
): Promise<CosineGroup> {
  const { weights, ...rest } = options;
  const members = await Promise.all(urls.map((url) => loadIndex(url, rest)));
  return new CosineGroup(members, weights ? { weights } : {});
}
