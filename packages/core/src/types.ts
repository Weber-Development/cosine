/** A page or file before it is split into chunks. */
export interface SourceDocument {
  /** Stable id, e.g. the file path relative to the docs root. */
  id: string;
  /** Link to the page, e.g. `/docs/getting-started`. */
  url: string;
  title: string;
  /** Plain text or Markdown. */
  content: string;
}

/** One searchable passage of a page, usually one section below a heading. */
export interface Chunk {
  /** Position in the index. */
  id: number;
  /** Id of the source document. */
  doc: string;
  /** Link to the passage, including the heading anchor when there is one. */
  url: string;
  /** Page title. */
  title: string;
  /** Heading path below the page title, e.g. `["Install", "pnpm"]`. */
  headings: string[];
  /** Plain text of the passage. */
  text: string;
}

/** How a text is embedded. Some models (E5, BGE) expect different prefixes for queries and passages. */
export type EmbedKind = "query" | "passage";

/**
 * Turns text into vectors. The index and the browser must use the same model.
 *
 * @experimental Custom embedders work today, but the interface may get new optional members in a
 * minor release.
 */
export interface Embedder {
  /** Model id stored in the index, e.g. `Xenova/all-MiniLM-L6-v2`. */
  readonly model: string;
  /** Vector length. Known after the first call when the model does not say it up front. */
  readonly dimensions?: number;
  embed(texts: string[], kind: EmbedKind): Promise<Float32Array[]>;
}

/** Index metadata written to `cosine-index.json`. */
export interface IndexManifest {
  /** Format version of the index files. */
  version: 1;
  /** Embedding model, or `null` for a lexical-only index. */
  model: string | null;
  /** Options the browser needs to load the same model. */
  modelOptions?: ModelOptions;
  dimensions: number;
  /** File name of the vectors next to the manifest, or `null` for a lexical-only index. */
  vectors: string | null;
  chunks: Chunk[];
  /** Groups of words that mean the same, e.g. `[["login", "sign-in"]]`. */
  synonyms?: string[][];
  /** Ranking weights per URL path, e.g. `{ "/docs/api": 1.5 }`. */
  boost?: Record<string, number>;
  createdAt: string;
}

export interface ModelOptions {
  /** Weight precision, e.g. `q8` (default) or `fp32`. */
  dtype?: string;
  /** Prefix for queries, e.g. `query: ` for E5 models. */
  queryPrefix?: string;
  /** Prefix for passages, e.g. `passage: ` for E5 models. */
  passagePrefix?: string;
  /** Semantic hits below this cosine similarity are dropped. Depends on the model. */
  minSimilarity?: number;
}

export type SearchMode = "hybrid" | "lexical" | "semantic";

export interface SearchOptions {
  /** Maximum number of results. Default 8. */
  limit?: number;
  /** `hybrid` (default) uses semantic ranking once the model is ready and lexical ranking until then. */
  mode?: SearchMode;
  /** Return at most one result per page. Default false. */
  groupByPage?: boolean;
  /**
   * Only return results whose URL starts with one of these paths, e.g. `/docs/api`. A full URL
   * is compared by its path. Default: the whole index.
   */
  scope?: string | string[];
}

export interface SearchResult {
  chunk: Chunk;
  /** Higher is better. Only comparable within one search. */
  score: number;
  /** Which rankings found this result. */
  matchedBy: Array<"lexical" | "semantic">;
  /** Short excerpt around the best match. */
  snippet: string;
  /** `[start, end)` ranges in `snippet` that match query words. */
  highlights: Array<[number, number]>;
}

export type SearchStatus = "lexical" | "loading-model" | "ready" | "model-failed";
