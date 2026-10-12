# @sweberdev/cosine-react

## 2.0.0

### Major Changes

- e1dc03b: Cosine 2.0. Index format 2 is smaller (page titles and URLs are stored once), can be split into shards (`--shard-size`) and can use 4-bit vectors (`--vector-bits 4`); format 1 is still read, with a warning. Chinese, Japanese, Thai and other scripts without spaces are split into words, so they can be searched and highlighted. New build integrations: `@sweberdev/cosine/astro` (Starlight too), `/docusaurus` and `/vitepress`. `Embedder`, `transformersEmbedder` and `DEFAULT_MODEL` are stable. Node 22 or later is required. Browser tests also run in Firefox and WebKit. See "Migrating to 2.0" in the docs.

### Patch Changes

- Updated dependencies [e1dc03b]
  - @sweberdev/cosine@2.0.0

## 2.0.0-next.0

### Major Changes

- e1dc03b: Cosine 2.0. Index format 2 is smaller (page titles and URLs are stored once), can be split into shards (`--shard-size`) and can use 4-bit vectors (`--vector-bits 4`); format 1 is still read, with a warning. Chinese, Japanese, Thai and other scripts without spaces are split into words, so they can be searched and highlighted. New build integrations: `@sweberdev/cosine/astro` (Starlight too), `/docusaurus` and `/vitepress`. `Embedder`, `transformersEmbedder` and `DEFAULT_MODEL` are stable. Node 22 or later is required. Browser tests also run in Firefox and WebKit. See "Migrating to 2.0" in the docs.

### Patch Changes

- Updated dependencies [e1dc03b]
  - @sweberdev/cosine@2.0.0-next.0

## 1.0.0

### Major Changes

- 32c7135: Cosine 1.0. The public API of 0.9 is now stable and follows semantic versioning: patch releases fix bugs, minor releases only add, and breaking changes wait for 2.0. Nothing changes in the API or the behaviour, so 0.9 users upgrade without changes.

### Patch Changes

- Updated dependencies [32c7135]
  - @sweberdev/cosine@1.0.0

## 0.9.0

### Minor Changes

- 77ef55a: API freeze candidate. We reviewed the whole public API and froze it with a test that lists every export, `<cosine-search>` attribute and part, and CLI option, so any removal or rename in 1.x fails CI. The new Stability page says what 1.x promises and which parts (custom embedders, model presets, chunking rules) are still experimental, and those exports are now tagged `@experimental`. New guides cover migrating from Pagefind, Orama, MiniSearch and Lunr, setups for Next.js, Astro, VitePress, Docusaurus, SvelteKit, Vue and plain HTML, and troubleshooting, plus reference pages for performance and upgrading. A nightly CI job now runs the real-model test every day. There are no breaking changes: 0.9 is a drop-in upgrade.

### Patch Changes

- Updated dependencies [77ef55a]
  - @sweberdev/cosine@0.9.0

## 0.8.0

### Minor Changes

- a5b1727: Accessibility fix found by the new browser tests: in `<cosine-search>` the link inside each result is now the option itself (`<a role="option">`) instead of sitting inside an `<li role="option">`. Screen readers no longer meet a link nested in an option, and an axe scan of the open list reports no violations. The `result` part still styles the list item, the markup of `result-title` and `result-snippet` is unchanged. Also new: Playwright tests for keyboard use, ARIA and axe in real Chromium, and benchmarks with fixed limits for index size and search time in CI.

### Patch Changes

- Updated dependencies [a5b1727]
  - @sweberdev/cosine@0.8.0

## 0.7.0

### Minor Changes

- 737760c: Several indexes and filter buttons. `<cosine-search index="/docs/cosine-index.json /blog/cosine-index.json">` searches several indexes as one and merges the results by rank (`loadIndexes()` and `CosineGroup` in code, with optional weights). The new `facets` attribute shows filter buttons per section of the site with result counts. `CosineSearch` for React takes an array for `index` and a `facets` prop. New texts for the buttons in English, German, French and Italian.

### Patch Changes

- Updated dependencies [737760c]
  - @sweberdev/cosine@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [f33b3ab]
  - @sweberdev/cosine@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [817f40f]
  - @sweberdev/cosine@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [595ec72]
  - @sweberdev/cosine@0.4.0

## 0.3.0

### Minor Changes

- 48b95cd: Typo tolerance and scoped search. A word that is not in the index now also matches close spellings (edit distance 1, from eight letters on 2), so `instalation` finds `installation` without the model. The new `scope` option, `scope` attribute and `scope` prop limit a search to URL paths such as `/docs/api`.

### Patch Changes

- Updated dependencies [48b95cd]
  - @sweberdev/cosine@0.3.0

## 0.2.0

### Minor Changes

- 678e64e: `<cosine-search>` fires `cosine-results` after each search, and `cosine-select` now carries the query and the rank of the chosen result.

### Patch Changes

- Updated dependencies [678e64e]
  - @sweberdev/cosine@0.2.0
