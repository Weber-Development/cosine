# @sweberdev/cosine

## 1.0.0

### Major Changes

- 32c7135: Cosine 1.0. The public API of 0.9 is now stable and follows semantic versioning: patch releases fix bugs, minor releases only add, and breaking changes wait for 2.0. Nothing changes in the API or the behaviour, so 0.9 users upgrade without changes.

## 0.9.0

### Minor Changes

- 77ef55a: API freeze candidate. We reviewed the whole public API and froze it with a test that lists every export, `<cosine-search>` attribute and part, and CLI option, so any removal or rename in 1.x fails CI. The new Stability page says what 1.x promises and which parts (custom embedders, model presets, chunking rules) are still experimental, and those exports are now tagged `@experimental`. New guides cover migrating from Pagefind, Orama, MiniSearch and Lunr, setups for Next.js, Astro, VitePress, Docusaurus, SvelteKit, Vue and plain HTML, and troubleshooting, plus reference pages for performance and upgrading. A nightly CI job now runs the real-model test every day. There are no breaking changes: 0.9 is a drop-in upgrade.

## 0.8.0

### Minor Changes

- a5b1727: Accessibility fix found by the new browser tests: in `<cosine-search>` the link inside each result is now the option itself (`<a role="option">`) instead of sitting inside an `<li role="option">`. Screen readers no longer meet a link nested in an option, and an axe scan of the open list reports no violations. The `result` part still styles the list item, the markup of `result-title` and `result-snippet` is unchanged. Also new: Playwright tests for keyboard use, ARIA and axe in real Chromium, and benchmarks with fixed limits for index size and search time in CI.

## 0.7.0

### Minor Changes

- 737760c: Several indexes and filter buttons. `<cosine-search index="/docs/cosine-index.json /blog/cosine-index.json">` searches several indexes as one and merges the results by rank (`loadIndexes()` and `CosineGroup` in code, with optional weights). The new `facets` attribute shows filter buttons per section of the site with result counts. `CosineSearch` for React takes an array for `index` and a `facets` prop. New texts for the buttons in English, German, French and Italian.

## 0.6.0

### Minor Changes

- f33b3ab: Search syntax and boosting. Queries accept `"exact phrases"` and `-excluded` words in every mode, also for the semantic ranking. `cosine build --boost /docs/api=1.5 --boost /blog=0.7` stores ranking weights per URL path in the index (`BuildOptions.boost`, `CosineOptions.boost`). New exports: `parseQuery`, `LexicalIndex#constraints`.

## 0.5.0

### Minor Changes

- 817f40f: Facets: `cosine.facets(query, { depth })` counts the results of a query per section of the site (`/docs/guides` 12, `/docs/api` 5), so a search page can offer filters. A facet's path works as `scope`.

## 0.4.0

### Minor Changes

- 595ec72: Synonyms and incremental builds. `cosine build --synonyms synonyms.json` stores synonym groups in the index, so `login` also finds `sign in`, even in keyword search before the model has loaded. `cosine build --incremental` reuses the vectors of the existing index and embeds only new and changed sections. New: `BuildOptions.synonyms`, `BuildOptions.previous`, `CosineOptions.synonyms`, `readIndex()` and `VectorStore#vector()`.

## 0.3.0

### Minor Changes

- 48b95cd: Typo tolerance and scoped search. A word that is not in the index now also matches close spellings (edit distance 1, from eight letters on 2), so `instalation` finds `installation` without the model. The new `scope` option, `scope` attribute and `scope` prop limit a search to URL paths such as `/docs/api`.

## 0.2.0

### Minor Changes

- 678e64e: `<cosine-search>` fires `cosine-results` after each search, and `cosine-select` now carries the query and the rank of the chosen result.
