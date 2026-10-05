import {
  type Cosine,
  type LoadIndexOptions,
  loadIndex,
  type SearchOptions,
  type SearchResult,
  type SearchStatus,
} from "@sweberdev/cosine";
import { useEffect, useState } from "react";

export interface UseCosineResult {
  /** The engine, `null` while the index loads. */
  cosine: Cosine | null;
  status: SearchStatus;
  error: Error | null;
}

/**
 * Loads an index once per URL. Pass the result to `useCosineSearch`.
 *
 * ```tsx
 * const { cosine } = useCosine("/cosine/cosine-index.json");
 * ```
 */
export function useCosine(url: string, options: LoadIndexOptions = {}): UseCosineResult {
  const [cosine, setCosine] = useState<Cosine | null>(null);
  const [status, setStatus] = useState<SearchStatus>("lexical");
  const [error, setError] = useState<Error | null>(null);
  const { loadModel } = options;

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload only when the URL or model policy changes
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    setCosine(null);
    setError(null);
    loadIndex(url, options).then(
      (c) => {
        if (cancelled) return;
        setCosine(c);
        setStatus(c.status);
        unsubscribe = c.onStatus(setStatus);
      },
      (e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      },
    );
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [url, loadModel]);

  return { cosine, status, error };
}

export interface UseCosineSearchResult {
  results: SearchResult[];
  /** True while the semantic ranking for the current query is computed. */
  pending: boolean;
}

/**
 * Searches as the query changes: lexical results right away, the hybrid ranking as soon as the
 * model is ready. Stale answers of earlier queries are ignored.
 */
export function useCosineSearch(
  cosine: Cosine | null,
  query: string,
  options: SearchOptions = {},
): UseCosineSearchResult {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<SearchStatus | null>(cosine?.status ?? null);
  const { limit, mode, groupByPage } = options;

  useEffect(() => {
    if (!cosine) return;
    setStatus(cosine.status);
    return cosine.onStatus(setStatus);
  }, [cosine]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: status re-runs the search when the model is ready
  useEffect(() => {
    if (!cosine || !query.trim()) {
      setResults([]);
      setPending(false);
      return;
    }
    let current = true;
    const opts: SearchOptions = { limit, mode, groupByPage };
    if (mode !== "semantic") setResults(cosine.searchLexical(query, opts));
    if (mode === "lexical" || (mode !== "semantic" && cosine.status !== "ready")) {
      // Starts loading the model in the background for the next keystroke.
      void cosine.search(query, opts);
      setPending(false);
      return;
    }
    setPending(true);
    cosine.search(query, opts).then((r) => {
      if (!current) return;
      setResults(r);
      setPending(false);
    });
    return () => {
      current = false;
    };
  }, [cosine, query, limit, mode, groupByPage, status]);

  return { results, pending };
}
