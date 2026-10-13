---
title: Docusaurus
description: Replace the Docusaurus search with Cosine: one index per locale, a model per language and an embedding cache for fast builds.
---

`@weber-development/cosine-docusaurus` is a ready-made plugin and theme for Docusaurus 3. It renders `<cosine-search>` in the navbar search item and builds the search index of every locale after `docusaurus build`. The free `@sweberdev/cosine/docusaurus` integration only indexes; this package adds the search box, the embedding cache and models per locale.

```sh
pnpm add @weber-development/cosine-docusaurus @sweberdev/cosine @huggingface/transformers
```

## Set it up

Add the package to `themes` and keep the navbar's `type: "search"` item:

```js
// docusaurus.config.js
export default {
  themes: [
    [
      "@weber-development/cosine-docusaurus",
      { models: { en: "english", de: "multilingual" } },
    ],
  ],
  themeConfig: {
    navbar: { items: [{ type: "search", position: "right" }] },
  },
};
```

Run `docusaurus build`. The index lands in `build/cosine/`, and in `build/<locale>/cosine/` for every other locale. Test it with `docusaurus serve`; the dev server (`docusaurus start`) has no index.

Do not enable another search at the same time. Remove `@docusaurus/theme-search-algolia`, the `themeConfig.algolia` block and local search themes such as `@easyops-cn/docusaurus-search-local`. They also provide `@theme/SearchBar`, and the last theme in the config wins.

## Options

| Option | Default | Meaning |
|---|---|---|
| `model` | `english` | Model for locales without an entry in `models`; `false` for keyword search only |
| `models` | | Model per locale, e.g. `{ en: "english", de: "multilingual" }` |
| `out` | `cosine` | Folder of the index in the built site |
| `cacheDir` | `node_modules/.cache/cosine` | Embedding cache; `false` turns it off |
| `exclude` | | Paths of the built site to skip. `404.html` and `assets/` are always skipped |
| `shardSize` | one file | Split the index into files of about this many sections |
| `synonyms` | | Groups of words that mean the same |
| `boost` | | Weight per path |
| `vectorBits` | `8` | `4` or `8` |

## Several languages

Docusaurus builds each locale on its own, so each locale gets its own index, built with the model you chose for it. The search box loads the index of the locale the visitor is reading and uses the locale's language for its texts. The default locale's index does not contain the pages of other locales.

## Faster builds

Embeddings are cached per locale and model in `node_modules/.cache/cosine`. A rebuild embeds only sections that changed. Cache that folder in CI.

## Look

Colours come from the Docusaurus variables (`--ifm-color-primary`, `--ifm-background-color`, `--ifm-font-color-base` and others), so dark mode follows the theme. For more control, style `cosine-search::part(input)` and `::part(panel)` or swizzle `SearchBar`.

## Limits

- No index in the dev server; build first.
- Page titles are the HTML `<title>`, usually `Page | Site name`.
- The search box shows in the desktop navbar only, like the classic search item. The mobile menu has none.
- With a model, webpack bundles the Hugging Face runtime (about 27 MB of WebAssembly in the output). Browsers load it only when search is first used.
- Tested with a real `docusaurus build` of Docusaurus 3.10 (classic preset, two locales) and checked in the generated HTML and bundle. Not tried in a real browser.
