import type { Cosine, SearchResult } from "@sweberdev/cosine";
import { defineCosineSearch } from "@sweberdev/cosine/element";
import { type CSSProperties, createElement, useEffect, useRef } from "react";

export interface CosineSearchProps {
  /** URL of `cosine-index.json`. Not needed when `cosine` is set. */
  index?: string;
  /** An engine loaded with `useCosine`, shared with other components. */
  cosine?: Cosine | null;
  /** `en`, `de`, `fr` or `it`. Defaults to the page language. */
  lang?: string;
  placeholder?: string;
  label?: string;
  limit?: number;
  /** Search only below these URL paths, e.g. `"/docs/api"` or `["/docs/api", "/docs/guides"]`. */
  scope?: string | string[];
  /** `/` (default), `mod+k` or `none`. */
  shortcut?: string;
  loadModel?: "lazy" | "eager" | "never";
  /** Called before navigating. Return `false` to handle navigation yourself (e.g. with a router). */
  onSelect?: (result: SearchResult) => boolean | undefined;
  className?: string;
  style?: CSSProperties;
}

/** The `<cosine-search>` web component as a React component. Renders nothing on the server but the tag. */
export function CosineSearch({ cosine, onSelect, loadModel, ...props }: CosineSearchProps) {
  const ref = useRef<HTMLElement & { cosine: Cosine | null }>(null);

  useEffect(() => {
    defineCosineSearch();
  }, []);

  useEffect(() => {
    if (ref.current && cosine) ref.current.cosine = cosine;
  }, [cosine]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onSelect) return;
    const listener = (e: Event) => {
      if (onSelect((e as CustomEvent<SearchResult>).detail) === false) e.preventDefault();
    };
    el.addEventListener("cosine-select", listener);
    return () => el.removeEventListener("cosine-select", listener);
  }, [onSelect]);

  const { className, limit, scope, ...rest } = props;
  return createElement("cosine-search", {
    ref,
    class: className,
    ...rest,
    ...(limit !== undefined && { limit: String(limit) }),
    ...(scope && { scope: Array.isArray(scope) ? scope.join(" ") : scope }),
    ...(loadModel && { "load-model": loadModel }),
    suppressHydrationWarning: true,
  });
}
