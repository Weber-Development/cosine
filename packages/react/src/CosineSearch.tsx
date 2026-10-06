import type { Cosine, CosineGroup, SearchResult } from "@sweberdev/cosine";
import { defineCosineSearch } from "@sweberdev/cosine/element";
import { type CSSProperties, createElement, useEffect, useRef } from "react";

export interface CosineSearchProps {
  /** URL of `cosine-index.json`, or several to search them as one. Not needed when `cosine` is set. */
  index?: string | string[];
  /** An engine loaded with `useCosine`, shared with other components. */
  cosine?: Cosine | CosineGroup | null;
  /** Show filter buttons per section of the site. A number sets the path segments per section. */
  facets?: boolean | number;
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
  const ref = useRef<HTMLElement & { cosine: Cosine | CosineGroup | null }>(null);

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

  const { className, limit, scope, index, facets, ...rest } = props;
  return createElement("cosine-search", {
    ref,
    class: className,
    ...rest,
    ...(index && { index: Array.isArray(index) ? index.join(" ") : index }),
    ...(facets && { facets: facets === true ? "" : String(facets) }),
    ...(limit !== undefined && { limit: String(limit) }),
    ...(scope && { scope: Array.isArray(scope) ? scope.join(" ") : scope }),
    ...(loadModel && { "load-model": loadModel }),
    suppressHydrationWarning: true,
  });
}
