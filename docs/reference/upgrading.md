---
title: Upgrading
description: What changed in each version from 0.1 to 1.0 and what you need to do.
---

**0.9 is a drop-in upgrade from 0.8.** It adds documentation, a test that freezes the API and `@experimental` tags in the type definitions. Nothing in the behaviour changes. See [Stability](stability.md) for what 1.x promises.

Every version before it was also additive, with one exception: 0.8 changed the markup of the results list (see below). `@sweberdev/cosine` and `@sweberdev/cosine-react` are released together with the same version number. Index files stay at format version 1 throughout, but an index built with an older version lacks newer features, such as synonyms or boost weights, until you rebuild it.

| Version | What is new | What to do |
|---|---|---|
| 0.9 | API freeze candidate, guides, `@experimental` tags | Nothing |
| 0.8 | Each result in `<cosine-search>` is now an `<a role="option">` instead of a link inside an `<li role="option">`. Browser tests with axe. Benchmarks in CI | If you style the results with `::part(result)`, check the list once: the part now styles the link element. `result-title` and `result-snippet` are unchanged |
| 0.7 | Several indexes (`index="a.json b.json"`, `loadIndexes`, `CosineGroup`), the `facets` attribute and prop | Nothing |
| 0.6 | `"exact phrases"` and `-excluded` words in queries, `--boost`, `parseQuery` | Nothing. Rebuild to store boost weights |
| 0.5 | `cosine.facets(query, { depth })` | Nothing |
| 0.4 | `--synonyms`, `--incremental`, `readIndex`, `BuildOptions.synonyms` and `previous` | Nothing. Rebuild to store synonyms |
| 0.3 | Typo tolerance in keyword search, `scope` option, attribute and prop | Nothing |
| 0.2 | `cosine-results` event. `cosine-select` carries `query` and `rank` | Nothing |
| 0.1 | First release: `cosine build`, `cosine search`, `loadIndex`, `<cosine-search>`, React component and hooks | |

## Upgrading step by step

```sh
npm i @sweberdev/cosine@latest @sweberdev/cosine-react@latest
npx cosine build docs --out public/cosine --base-url /docs
```

Rebuild the index with the new version so that it contains the newest fields. The old index keeps working if you skip this.

## To 1.0

0.9 is the candidate for the API freeze. If nobody finds a problem with its surface, 1.0 keeps it unchanged, and upgrading from 0.9 to 1.0 will need no changes either. Breaking changes after 1.0 wait for 2.0.
