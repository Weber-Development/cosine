# @sweberdev/cosine

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
