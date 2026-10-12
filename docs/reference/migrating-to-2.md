---
title: Migrating to 2.0
description: What changes in Cosine 2.0, who is affected and what to do, step by step.
---

Most sites upgrade by installing 2.0 and rebuilding the index. This page lists every breaking change, so you can check whether it touches you.

```sh
npm i @sweberdev/cosine@latest @sweberdev/cosine-react@latest
npx cosine build docs --out public/cosine   # same command as before, now writes format 2
```

If you use Cosine Pro, update to 1.0.1 or later of the Pro packages first. They accept Cosine 2.x. Pro 2.0 is not required: Pro 1.x works with Cosine 2.

## Breaking changes

### 1. Node 22 or later

`@sweberdev/cosine` needs Node 22 for the CLI, `@sweberdev/cosine/node` and the build integrations. Node 20 reached its end of life in April 2026. The browser code has no new requirement.

### 2. Index format 2

`cosine build` now writes `version: 2`. The file is smaller (15 percent for these docs): page id, URL and title are stored once per page, and every section is a short array instead of an object. Cosine 2 still reads format 1, with one `console.warn`; Cosine 1.x cannot read format 2. Rebuild when you upgrade, and deploy the new index together with the new JavaScript.

**Do you read `cosine-index.json` yourself?** Then your code sees arrays where it saw objects. Use the parser instead of `JSON.parse`:

```ts
import { parseManifest } from "@sweberdev/cosine";

const manifest = parseManifest(await (await fetch("/cosine/cosine-index.json")).json());
manifest.chunks[0].url; // as before
```

`loadIndex`, `loadIndexes`, `loadIndexFile` and `readIndex` already do this.

### 3. Words in Chinese, Japanese, Thai and similar scripts

These scripts have no spaces between words. Cosine 1 treated a whole run of characters as one word. Cosine 2 splits them with `Intl.Segmenter`, so a search for `東京` finds `東京タワー` and the snippet highlights it. The side effect is that results for these languages change. Nothing is stored in the index for this, so a rebuild is not needed.

Accent folding now only applies to Latin, Greek, Cyrillic, Arabic and Hebrew text. Before, it also stripped marks in other scripts, for instance the dakuten that tells `か` from `が`.

### 4. Stable APIs

`Embedder`, `transformersEmbedder` and `DEFAULT_MODEL` lose their `@experimental` tag. This changes no behaviour. The presets in `MODELS` stay experimental.

## Not changed

- **The default model** stays `english` (23 MB). A multilingual default would make every English site download about 120 MB. Pick `--model multilingual` if your pages or visitors are not English.
- **Everything marked deprecated** in 1.x: nothing was deprecated, so nothing is removed.
- **The web component**, its attributes, parts and events, and the React components.

## New in 2.0

- **Compact index, shards and 4-bit vectors** for large sites: [Large sites](../guides/indexing.md#large-sites).
- **Integrations** `@sweberdev/cosine/astro` (Starlight too), `/docusaurus` and `/vitepress`: [Recipes](../guides/recipes.md).
- **Words and highlighting** for languages without spaces.
- **Browser tests in Firefox and WebKit** next to Chromium on every pull request.
- **Cosine Pro:** golden-query tests (`cosine-quality`), synonym proposals as a pull request, answers in more languages. See [Cosine Pro](../pro/overview.md).

## Cosine 1.x keeps getting fixes

Security and bug fixes for 1.x continue for 12 months after the day 2.0.0 is released.
