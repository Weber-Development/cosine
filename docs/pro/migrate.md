---
title: Migrating from Algolia
description: Turn an Algolia DocSearch export into a Cosine index without crawling your site again.
---

`@weber-development/cosine-migrate` converts the records and synonyms you export from Algolia into a Cosine index. The search then runs in the browser, without an account, a server or an API key.

```sh
npm i -D @weber-development/cosine-migrate
npx cosine-migrate algolia --records records.json --synonyms synonyms.json --out public/cosine
```

```html
<cosine-search index="/cosine/cosine-index.json"></cosine-search>
```

## Export from Algolia

In the Algolia dashboard open your index and use *Manage index → Export*, or browse the index with the API. Cosine reads a JSON array, an object with a `hits` array, or NDJSON. Synonyms come from *Configuration → Synonyms*.

## How records become pages

DocSearch stores one record per heading or paragraph. The tool groups them by page URL, then:

- `hierarchy.lvl1` becomes the page title.
- `lvl2` and deeper become `##` to `####` headings, with the anchor from the URL hash, so results link to the exact section.
- Content records become the text under their heading, in the order of `weight.position`.
- Flat `hierarchy_lvl0` keys work like the nested form.

URLs are reduced to path and hash, so the same index works on staging and production. `--keep-origin` keeps the domain.

## Synonyms

| Algolia | Cosine |
|---|---|
| synonym (several words that mean the same) | one synonym group |
| oneWaySynonym | one group of the input and its synonyms |
| placeholder, altCorrection | dropped |

The command prints how many groups were converted and how many were dropped.

## Options

| Option | Default | |
|---|---|---|
| `--records <file>` | | Export from Algolia. Required |
| `--synonyms <file>` | | Synonyms export |
| `--out <dir>` | `public/cosine` | Output directory |
| `--keep-origin` | off | Keep the domain in URLs |
| `--lang <code>` | all | Only records of this language |
| `--model <id>` | `english` | `english`, `multilingual` or a Hugging Face model id |
| `--lexical-only` | off | No embeddings, keyword search only |
| `--incremental` | off | Reuse the vectors of the index already in `--out` |
| `--boost <path=n>` | | Rank results below a path higher or lower, repeatable |

## From code

```ts
import { migrateFromAlgolia } from "@weber-development/cosine-migrate";

const result = await migrateFromAlgolia({
  records: "records.json",
  synonyms: "synonyms.json",
  out: "public/cosine",
});
console.log(result.pages, result.records, result.synonyms);
```

`records` and `synonyms` accept a file path or the parsed array.

## After the migration

Algolia's ranking rules and facets are not copied. Use [boost](../guides/indexing.md) for sections that should rank higher, and `facets` on the search element to filter by path. Once the new search works, remove the DocSearch script and delete the Algolia index.
