---
title: Troubleshooting
description: Symptoms and fixes for missing results, a model that does not load, CORS, base paths, large indexes and hidden filters.
---

Open the browser console first. Cosine logs errors there with the prefix `cosine:`.

## No results

Check these in order:

1. **The build found your pages.** `cosine build` prints `Indexed 42 pages as 186 chunks`. If the number is 0 or too low, check the directory you passed, the file extensions (`.md`, `.mdx`, `.markdown`, `.html`, `.htm`, `.txt`), your `--exclude` options, and whether HTML pages have `<meta name="robots" content="noindex">` (they are skipped).
2. **HTML pages have content in `<main>`.** Cosine reads `<main>`, then `<article>`, then `<body>`. Elements with `data-cosine-ignore` are dropped.
3. **The index is found.** Open `/cosine/cosine-index.json` in the browser. A 404 shows up in the console as `cosine: could not load ... (404)`, and a missing `index` attribute as `cosine-search: missing index attribute`.
4. **No `scope` limits the search.** A `scope` attribute or option hides everything outside those paths.
5. **The query is not only an exclusion.** `-retry` alone has nothing to find. Add a word that should match.
6. **The semantic ranking does not cut your query.** Semantic hits below the minimum similarity are dropped, so nonsense finds nothing. Try the same query with `mode="lexical"`; if that finds results, lower `minSimilarity` in `loadIndex` (see [Models](models.md#relevance-threshold)).

Try the query in the terminal: `npx cosine search public/cosine "your query" --mode lexical`.

## Only keyword results, the model never loads

The status of the search is `lexical` until the model is requested, then `loading-model` and `ready`, or `model-failed`. Reasons for staying on keywords:

- **The browser asks to save data.** With `load-model="lazy"` (the default), Cosine stays lexical when the visitor has "save data" turned on. Use `load-model="eager"` to load the model anyway.
- **`load-model="never"`, `mode="lexical"` or an index built with `--lexical-only`.** These never load a model, on purpose.
- **A Content Security Policy blocks the download.** The model comes from `huggingface.co`, and transformers.js loads its WebAssembly runtime from a CDN. The console shows a CSP violation. Allow the hosts in `connect-src`, allow WebAssembly in `script-src` (`'wasm-unsafe-eval'`) and, if needed, the CDN for scripts. Or serve both yourself, see [Privacy and self-hosting](privacy.md#serving-the-model-from-your-own-domain), and the policy can stay strict.
- **The visitor is offline or the host is blocked** (a company firewall, a privacy extension). The status becomes `model-failed` and keyword search keeps working.
- **`@huggingface/transformers` is not installed** in the project that bundles the search.

## The index files fail to load from another domain (CORS)

The browser fetches `cosine-index.json` and the vector file with `fetch`. From another origin (for example a CDN domain) the server must send `Access-Control-Allow-Origin` for your site. The simplest fix is to serve the index from the same domain as the page. If you use a CDN, add the header there, for both files.

## Results link to the wrong page, or the index is not found

- The `index` attribute is a URL as the browser sees it. If the site lives below `/docs/`, use `index="/docs/cosine/cosine-index.json"` and make sure the files are actually served there. Relative URLs depend on the current page, so prefer absolute paths.
- The links in the results come from the build: `--base-url /docs` makes `guides/cli.md` link to `/docs/guides/cli`. Set it to the path where the pages are served, or the clicks end in 404 pages.
- With a framework that adds a `trailingSlash` or `.html` suffix, check one result URL in the console (`cosine-results` event) against the real page URL. If they differ, build from the generated HTML instead of the sources, since Cosine maps `about/index.html` to `/about/`.
- Use `cosine-select` with `preventDefault()` to navigate with your router when the site is a single page application, see [Search field](web-component.md#events).

## The index is too large

Check the size of `public/cosine` first, and compare it with [Performance](../reference/performance.md): the vectors need about 390 bytes per section, the manifest also contains the text of every section.

- Exclude pages nobody searches: `--exclude drafts/`, `--exclude changelog/`.
- Raise `--max-chars` to get fewer, longer sections (the default is 1200).
- Build with `--lexical-only` when you do not need the model: no vector file, no model download.
- Serve the files compressed (gzip or Brotli). The JSON compresses very well.
- If the site has tens of thousands of pages, Cosine is the wrong tool, see [Why Cosine](../introduction.md#when-not-to-use-cosine).

## "the index has N chunks but M vectors" or "built with X, the embedder uses Y"

Both errors mean that `cosine-index.json` and the vector file do not belong together, or the model does not match the vectors.

- **Different builds.** A CDN or the browser cache served an old vector file next to a new manifest (or the other way round). Deploy both files together and purge the cache for both.
- **Different model.** The index stores the model id. A custom `embedder` must use the same model as the one the index was built with. Rebuild with the model you want to use at search time.
- **Different prefixes.** For E5 and BGE models, build and search with the same `--query-prefix` and `--passage-prefix`, they are stored in the index.
- When in doubt, rebuild: `npx cosine build docs --out public/cosine` (without `--incremental`).

## The filter buttons do not show

- The `facets` attribute (or prop) must be set on `<cosine-search>`.
- With a single section in the results there is nothing to filter, so the buttons stay hidden. Search for a word that appears in more than one section.
- Filters are per section of the URL path. If all your pages share the first path segment (`/docs/...`), use `facets="2"` to filter by the first two (`/docs/guides`, `/docs/api`).
- Custom CSS can hide them. They are exposed as `::part(facets)`.

## Changes to the pages do not show up in search

The index is built at build time. Run `cosine build` again before you deploy, and make sure the build runs after the site is generated if you index built HTML. A browser may hold an old `cosine-index.json` in its cache; a hard reload fixes it, and your host's cache headers decide how long it lasts for visitors.

## Still stuck?

Open an issue at [github.com/Weber-Development/cosine](https://github.com/Weber-Development/cosine/issues) with the console output, the output of `cosine build` and the version of `@sweberdev/cosine`.
