---
title: Migrating to Cosine
description: Move from Pagefind, Orama, MiniSearch or Lunr to Cosine, with a mapping of concepts and an honest list of what you gain and lose.
---

Cosine is a good target when you search documentation and want results by meaning, without a server. It is not a general search engine. Read the "Lose" column of each section before you switch.

## From Pagefind

Pagefind and Cosine have the same shape: both index your built site at build time and search in the browser without a server.

| Pagefind | Cosine |
|---|---|
| `npx pagefind --site dist` | `npx cosine build dist --out dist/cosine` |
| `data-pagefind-body` to pick the content | Cosine reads `<main>`, then `<article>`, then `<body>` |
| `data-pagefind-ignore` | `data-cosine-ignore`, or `--exclude <path>` for whole files |
| `data-pagefind-weight`, ranking per element | `--boost /docs/api=1.5`, ranking per URL path |
| `data-pagefind-filter` and filter UI | `facets` attribute: filters by section of the URL, with counts. `scope` limits a search to paths |
| Pagefind UI | `<cosine-search index="/cosine/cosine-index.json">` |
| `pagefind.search(query)` and `result.data()` | `await cosine.search(query)`, results carry `chunk`, `snippet` and `highlights` |
| Synonyms via custom configuration | `--synonyms synonyms.json` |

What to change:

1. Replace the `pagefind` call in your build with `cosine build`, pointing at the built HTML or the Markdown sources. See [Building the index](indexing.md).
2. Replace the Pagefind UI script and stylesheet with the `<cosine-search>` element, see [Search field](web-component.md).
3. Move `data-pagefind-ignore` attributes to `data-cosine-ignore`.
4. Delete the `pagefind` output folder from your deploy.

**You gain:** results by meaning ("get rid of the app" finds "Uninstall"), hybrid ranking with exact words, typo tolerance before the model has loaded, section-level results with links to the heading, German, French and Italian texts.

**You lose:** Pagefind loads only the index parts a query needs, so it scales to very large sites. Cosine loads the whole index and, once the model is ready, compares against every vector. Beyond a few thousand pages, stay with Pagefind. Cosine has no filters on arbitrary metadata, only on URL paths. The model is a download of about 23 MB on first use (keyword results do not wait for it).

## From Orama

| Orama | Cosine |
|---|---|
| `create({ schema })` | No schema. A document is `{ id, url, title, content }` |
| `insert` / `insertMultiple` | `buildIndex(documents)`, or `cosine build <dir>` |
| Index lives in memory, optionally persisted | Index is two files (`cosine-index.json`, `cosine-vectors.bin`), written once at build time |
| `search(db, { term })` | `cosine.search(term)` |
| `mode: "fulltext" \| "vector" \| "hybrid"` | `mode: "lexical" \| "semantic" \| "hybrid"` (default) |
| Embeddings from your plugin or API | Built in with transformers.js, or your own `Embedder` (experimental, see [Stability](../reference/stability.md)) |
| `facets` on schema fields | `cosine.facets(query)` counts results per URL section |
| `where` filters on fields | `scope` on URL paths only |
| `boost` per field | `--boost` per URL path |

What to change: build the documents once (from files with `cosine build`, or from a CMS with `buildIndex`), ship the two files, and load them with `loadIndex`. There is no `insert` at runtime.

**You gain:** nothing to design (no schema, no chunking code), sections with anchors out of the box, an accessible search field, incremental rebuilds.

**You lose:** arbitrary fields and filters, runtime inserts and updates, and control over the schema. If you search products or records instead of documentation, Orama is the better fit.

## From MiniSearch and Lunr

| MiniSearch / Lunr | Cosine |
|---|---|
| `new MiniSearch({ fields, storeFields })` / `lunr(function () { this.field(...) })` | Not needed. Title, headings and text are indexed |
| `addAll(documents)` / `this.add(doc)` | `cosine build <dir>` or `buildIndex(documents)` |
| Serialised index (`toJSON`, `lunr` index JSON) | `cosine-index.json` plus the vector file |
| `search(q, { fuzzy: 0.2, prefix: true })` | On by default: close spellings match, and the last word matches as a prefix (`instal` finds `install`) |
| `search(q, { boost: { title: 2 } })` | Headings are indexed twice, so a heading match ranks higher. `--boost` ranks by URL path |
| Lunr `title:foo`, `+foo -bar`, wildcards | `"exact phrase"` and `-excluded` words. No field queries or wildcards |
| Your own result rendering | `<cosine-search>`, or `useCosine` in React, or `cosine.search()` and your own markup |

What to change: replace the index code with `cosine build` in your build step, replace the search call with `await cosine.search(query)`, and render `result.chunk.title`, `result.chunk.headings` and `result.snippet`. Results are sections (not whole pages); pass `groupByPage: true` for one result per page.

**You gain:** semantic ranking, ready-made accessible UI, snippets with highlights, no hand-written index code.

**You lose:** field queries and wildcards, and a lot of size: MiniSearch and Lunr need no model. If you only need keyword search and want the smallest download, build with `--lexical-only`, which uses no model at all.

## From Algolia

Cosine Pro converts an Algolia DocSearch export and its synonyms into a Cosine index. See [Migrating from Algolia](../pro/migrate.md).

## Checklist after any migration

1. Search for five questions your visitors ask, in their words. Compare the first result with the old search.
2. Add a [synonym](indexing.md#synonyms) list for the words your product uses differently from your visitors.
3. Check the size of `public/cosine` against [Performance](../reference/performance.md).
4. Read the [privacy notes](privacy.md): the model download is the only request to a third party, and you can host it yourself.
