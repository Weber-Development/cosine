import { transformersEmbedder } from "./embedder";
import { LexicalIndex, parseQuery } from "./lexical";
import { makeSnippet } from "./snippet";
import type {
  Chunk,
  Embedder,
  IndexManifest,
  SearchOptions,
  SearchResult,
  SearchStatus,
} from "./types";
import { VectorStore } from "./vectors";

export interface Facet {
  /** Path prefix, e.g. `/docs/api`. Pass it as `scope` to search only there. */
  path: string;
  /** Number of results below this path. */
  count: number;
}

export interface FacetOptions extends Omit<SearchOptions, "limit" | "groupByPage"> {
  /** Number of path segments that form a facet. Default 1: `/docs/api/auth` counts for `/docs`. */
  depth?: number;
  /** Results to count, from the top of the ranking. Default 200. */
  limit?: number;
}

export interface CosineOptions {
  manifest: IndexManifest;
  /** Vectors of the chunks. Without them Cosine searches lexically only. */
  vectors?: VectorStore | null;
  /**
   * The query embedder. Defaults to transformers.js with the model named in the index.
   * Pass `false` for lexical search only.
   */
  embedder?: Embedder | false;
  /**
   * When to load the model: `lazy` (default) on `warmup()` or the first search, `eager` right away,
   * `never` for lexical search only. With `lazy`, Cosine also stays lexical when the browser asks
   * to save data.
   */
  loadModel?: "lazy" | "eager" | "never";
  /**
   * Semantic hits below this cosine similarity are dropped, so nonsense queries find nothing.
   * Defaults to the value stored in the index for the model (0.2 for the English model).
   */
  minSimilarity?: number;
  /** Synonym groups, e.g. `[["login", "sign-in"]]`. Default: the ones stored in the index. */
  synonyms?: string[][];
  /**
   * Ranking weights per URL path, e.g. `{ "/docs/api": 1.5, "/blog": 0.7 }`: results below a path
   * are ranked higher (above 1) or lower (below 1). Default: the ones stored in the index.
   */
  boost?: Record<string, number>;
}

const RRF_K = 60;

/** Search over one index. Lexical results are instant, semantic ranking joins once the model is loaded. */
export class Cosine {
  readonly chunks: Chunk[];
  private readonly lexical: LexicalIndex;
  private readonly vectors: VectorStore | null;
  private readonly embedder: Embedder | null;
  private readonly loadModel: "lazy" | "eager" | "never";
  private readonly minSimilarity: number | undefined;
  private readonly boosts: Array<{ path: string; factor: number }>;
  private _status: SearchStatus;
  private warming: Promise<void> | undefined;
  private readonly listeners = new Set<(status: SearchStatus) => void>();
  private readonly queryCache = new Map<string, Promise<Float32Array>>();

  constructor(options: CosineOptions) {
    const { manifest } = options;
    this.chunks = manifest.chunks;
    this.lexical = new LexicalIndex(
      this.chunks.map(
        (c) => `${c.title} ${c.headings.join(" ")} ${c.headings.join(" ")} ${c.text}`,
      ),
      { synonyms: options.synonyms ?? manifest.synonyms ?? [] },
    );
    const boost = options.boost ?? manifest.boost ?? {};
    this.boosts = Object.entries(boost)
      .map(([path, factor]) => ({ path: pathOf(path.trim()).replace(/\/+$/, ""), factor }))
      .filter((b) => Number.isFinite(b.factor) && b.factor > 0 && b.factor !== 1)
      .sort((a, b) => b.path.length - a.path.length);
    this.vectors = options.vectors ?? null;
    if (this.vectors && this.vectors.count !== this.chunks.length) {
      throw new Error(
        `cosine: the index has ${this.chunks.length} chunks but ${this.vectors.count} vectors. Rebuild it.`,
      );
    }
    this.embedder =
      options.embedder === false || !this.vectors || !manifest.model
        ? null
        : (options.embedder ??
          transformersEmbedder({
            ...manifest.modelOptions,
            model: manifest.model,
          }));
    if (this.embedder && this.embedder.model !== manifest.model) {
      throw new Error(
        `cosine: the index was built with ${manifest.model}, the embedder uses ${this.embedder.model}.`,
      );
    }
    this.loadModel = this.embedder ? (options.loadModel ?? "lazy") : "never";
    this.minSimilarity = options.minSimilarity ?? manifest.modelOptions?.minSimilarity;
    this._status = "lexical";
    if (this.loadModel === "eager") void this.warmup();
  }

  /** `lexical` until the model is requested, then `loading-model`, `ready` or `model-failed`. */
  get status(): SearchStatus {
    return this._status;
  }

  /** True when this index can rank semantically at all. */
  get semantic(): boolean {
    return this.embedder !== null && this.loadModel !== "never";
  }

  /** Calls `listener` whenever the status changes. Returns an unsubscribe function. */
  onStatus(listener: (status: SearchStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Loads the model, e.g. when the search field gets focus. Resolves when it is ready; never
   * rejects (on failure the status becomes `model-failed` and search stays lexical).
   */
  warmup(): Promise<void> {
    if (!this.semantic || !this.embedder) return Promise.resolve();
    if (this.warming) return this.warming;
    const embedder = this.embedder;
    this.setStatus("loading-model");
    this.warming = embedder
      .embed(["warmup"], "query")
      .then(() => this.setStatus("ready"))
      .catch((error: unknown) => {
        this.warming = undefined;
        this.setStatus("model-failed");
        if (typeof console !== "undefined") console.warn("cosine: model failed to load", error);
      });
    return this.warming;
  }

  /** Lexical search only. Synchronous, for results on every keystroke. */
  searchLexical(query: string, options: SearchOptions = {}): SearchResult[] {
    const limit = options.limit ?? 8;
    const depth = options.scope
      ? Math.max(200, limit * 4)
      : options.groupByPage || this.boosts.length
        ? Math.max(50, limit * 4)
        : limit;
    const hits = this.lexical.search(query, depth);
    return this.finish(
      query,
      hits.map((h) => ({
        id: h.id,
        score: h.score,
        matchedBy: ["lexical"] as Array<"lexical" | "semantic">,
      })),
      options,
    );
  }

  /**
   * Searches with `mode` (default `hybrid`). Hybrid search does not wait for the model: until it
   * is ready the results are lexical, so re-run the search when `onStatus` reports `ready`.
   * `semantic` waits for the model.
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const mode = options.mode ?? "hybrid";
    if (!query.trim()) return [];
    if (mode === "lexical" || !this.semantic) return this.searchLexical(query, options);
    if (mode === "hybrid" && this._status !== "ready") {
      if (this.loadModel === "lazy" && !saveData()) void this.warmup();
      return this.searchLexical(query, options);
    }
    await this.warmup();
    if (this._status !== "ready") return this.searchLexical(query, options);

    const limit = options.limit ?? 8;
    const depth = Math.max(options.scope ? 200 : 50, limit * 4);
    const plain = parseQuery(query).text;
    const vector = await this.embedQuery(plain.trim() || query);
    const min = this.minSimilarity;
    const semantic = (this.vectors as VectorStore)
      .search(vector, depth)
      .filter((h) => min === undefined || h.score >= min);
    if (mode === "semantic") {
      return this.finish(
        query,
        semantic.map((h) => ({
          ...h,
          matchedBy: ["semantic"] as Array<"lexical" | "semantic">,
        })),
        options,
      );
    }
    const lexical = this.lexical.search(query, depth);
    return this.finish(query, fuse(lexical, semantic), options);
  }

  /**
   * Counts the results of a query per section of the site, e.g. `/docs/guides` 12, `/docs/api` 5,
   * so a search page can offer filters. Counts the top `limit` results, most results first. Use a
   * facet's `path` as `scope` to search only there.
   */
  async facets(query: string, options: FacetOptions = {}): Promise<Facet[]> {
    const { depth = 1, limit = 200, ...rest } = options;
    return countFacets(await this.search(query, { ...rest, limit }), depth);
  }

  private embedQuery(query: string): Promise<Float32Array> {
    const key = query.trim().toLowerCase();
    let cached = this.queryCache.get(key);
    if (!cached) {
      cached = (this.embedder as Embedder).embed([key], "query").then((v) => v[0] as Float32Array);
      cached.catch(() => this.queryCache.delete(key));
      this.queryCache.set(key, cached);
      if (this.queryCache.size > 100) {
        this.queryCache.delete(this.queryCache.keys().next().value as string);
      }
    }
    return cached;
  }

  private finish(
    query: string,
    hits: Array<{
      id: number;
      score: number;
      matchedBy: Array<"lexical" | "semantic">;
    }>,
    options: SearchOptions,
  ): SearchResult[] {
    const limit = options.limit ?? 8;
    const inScope = scopeFilter(options.scope);
    const allowed = this.lexical.constraints(query);
    const seen = new Set<string>();
    const out: SearchResult[] = [];
    for (const hit of this.boosted(hits)) {
      if (allowed && !allowed(hit.id)) continue;
      const chunk = this.chunks[hit.id];
      if (!chunk || !inScope(chunk.url)) continue;
      if (options.groupByPage) {
        if (seen.has(chunk.doc)) continue;
        seen.add(chunk.doc);
      }
      out.push({
        chunk,
        score: hit.score,
        matchedBy: hit.matchedBy,
        ...makeSnippet(chunk.text, query),
      });
      if (out.length >= limit) break;
    }
    return out;
  }

  /** Applies the path weights and re-sorts, or returns the hits as they are without any. */
  private boosted<T extends { id: number; score: number }>(hits: T[]): T[] {
    if (!this.boosts.length) return hits;
    const weight = (id: number) => {
      const path = pathOf(this.chunks[id]?.url ?? "");
      return (
        this.boosts.find((b) => b.path === "" || path === b.path || path.startsWith(`${b.path}/`))
          ?.factor ?? 1
      );
    };
    return hits
      .map((h) => ({ ...h, score: h.score * weight(h.id) }))
      .sort((a, b) => b.score - a.score || a.id - b.id);
  }

  private setStatus(status: SearchStatus) {
    if (status === this._status) return;
    this._status = status;
    for (const listener of this.listeners) listener(status);
  }
}

/** Reciprocal rank fusion: combines rankings without having to compare their scores. */
export function fuse(
  lexical: Array<{ id: number }>,
  semantic: Array<{ id: number }>,
): Array<{
  id: number;
  score: number;
  matchedBy: Array<"lexical" | "semantic">;
}> {
  const merged = new Map<
    number,
    { id: number; score: number; matchedBy: Array<"lexical" | "semantic"> }
  >();
  const add = (list: Array<{ id: number }>, source: "lexical" | "semantic") => {
    list.forEach((hit, rank) => {
      const entry = merged.get(hit.id) ?? {
        id: hit.id,
        score: 0,
        matchedBy: [],
      };
      entry.score += 1 / (RRF_K + rank + 1);
      entry.matchedBy.push(source);
      merged.set(hit.id, entry);
    });
  };
  add(lexical, "lexical");
  add(semantic, "semantic");
  return [...merged.values()].sort((a, b) => b.score - a.score || a.id - b.id);
}

function saveData(): boolean {
  const nav = (globalThis as { navigator?: { connection?: { saveData?: boolean } } }).navigator;
  return nav?.connection?.saveData === true;
}

export interface LoadIndexOptions extends Omit<CosineOptions, "manifest" | "vectors"> {
  /** Custom fetch, e.g. for tests or a service worker cache. */
  fetch?: typeof fetch;
}

/**
 * Loads an index written by `cosine build`: `cosine-index.json` plus the vector file next to it.
 *
 * ```ts
 * const cosine = await loadIndex("/cosine/cosine-index.json");
 * ```
 */
export async function loadIndex(
  url: string | URL,
  options: LoadIndexOptions = {},
): Promise<Cosine> {
  const doFetch = options.fetch ?? fetch;
  const res = await doFetch(String(url));
  if (!res.ok) throw new Error(`cosine: could not load ${String(url)} (${res.status})`);
  const manifest = (await res.json()) as IndexManifest;
  if (manifest.version !== 1)
    throw new Error(`cosine: unsupported index version ${String(manifest.version)}`);
  let vectors: VectorStore | null = null;
  if (manifest.vectors && options.embedder !== false && options.loadModel !== "never") {
    const vectorUrl = siblingUrl(String(url), manifest.vectors);
    const vres = await doFetch(vectorUrl);
    if (!vres.ok) throw new Error(`cosine: could not load ${vectorUrl} (${vres.status})`);
    vectors = VectorStore.fromBuffer(await vres.arrayBuffer());
  }
  return new Cosine({ ...options, manifest, vectors });
}

/** `/a/cosine-index.json` + `cosine-vectors.bin` → `/a/cosine-vectors.bin`, for relative and absolute URLs. */
export function siblingUrl(url: string, file: string): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(url)) return new URL(file, url).href;
  const path = url.replace(/[?#].*$/, "");
  return path.slice(0, path.lastIndexOf("/") + 1) + file;
}

/** Counts results per path prefix of `depth` segments, most results first. */
export function countFacets(results: Array<{ chunk: { url: string } }>, depth = 1): Facet[] {
  const counts = new Map<string, number>();
  for (const { chunk } of results) {
    const parts = pathOf(chunk.url).split("/").filter(Boolean).slice(0, Math.max(1, depth));
    const path = `/${parts.join("/")}`;
    counts.set(path, (counts.get(path) ?? 0) + 1);
  }
  return [...counts]
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
}

/** Path of a URL without origin, query and hash. */
function pathOf(url: string): string {
  const path = url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "").replace(/[?#].*$/, "");
  return path.startsWith("/") ? path : `/${path}`;
}

/** Matches whole path segments: `/docs/api` covers `/docs/api` and `/docs/api/auth`, not `/docs/apis`. */
export function scopeFilter(scope: string | string[] | undefined): (url: string) => boolean {
  const prefixes = (Array.isArray(scope) ? scope : scope ? [scope] : [])
    .map((s) => pathOf(s.trim()).replace(/\/+$/, ""))
    .filter((s) => s !== "");
  if (!prefixes.length) return () => true;
  return (url) => {
    const path = pathOf(url);
    return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
  };
}
