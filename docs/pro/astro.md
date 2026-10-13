---
title: Astro and Starlight
description: Replace the Starlight search with Cosine, build the index with cache and shards, and pick the model per page language.
---

`@weber-development/cosine-astro` is the ready-made plugin for Astro and Starlight. It builds the index in `astro dev` and `astro build`, swaps Starlight's search for `<cosine-search>`, and uses one index and model per language on multilingual sites.

```sh
pnpm add @weber-development/cosine-astro @sweberdev/cosine
```

## Starlight

```js title="astro.config.mjs"
import starlight from "@astrojs/starlight";
import cosineStarlight from "@weber-development/cosine-astro/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [
    starlight({ title: "Docs", plugins: [cosineStarlight()] }),
  ],
});
```

The plugin builds the index from `src/content/docs`, replaces the `Search` component (shortcut `Ctrl+K`), switches Pagefind off and maps Starlight's colour variables to Cosine's, so light and dark theme work. The index is written to `dist/cosine/`.

## Plain Astro

```js title="astro.config.mjs"
import cosineAstro from "@weber-development/cosine-astro";

export default defineConfig({ integrations: [cosineAstro({ docs: "src/content/docs" })] });
```

```astro title="src/layouts/Layout.astro"
---
import CosineSearch from "@weber-development/cosine-astro/CosineSearch.astro";
---
<CosineSearch placeholder="Search the docs" facets />
```

All attributes of `<cosine-search>` can be passed to the component, see [the search element](../guides/web-component.md).

## Several languages

With two or more Starlight locales (or Astro `i18n.locales` in plain Astro) every language gets its own index in `dist/cosine/<lang>/`. English uses the small English model, other languages the multilingual one, and a visitor downloads only the model of the language they read. Choose the models yourself with `models`:

```js
cosineStarlight({ models: { en: "english", de: "multilingual", fr: false } })
```

See [Languages](./i18n.md) for how a page's language is detected.

## Options

| Option | Default | |
|---|---|---|
| `docs` | `src/content/docs` | Folder with the pages |
| `baseUrl` | Astro `base` | URL prefix of the pages |
| `models` | | Model per language |
| `model` | `english` | One model for the whole site, or `false` for keyword search only |
| `cacheFile` | `node_modules/.cache/cosine/embeddings.json` | Embedding cache, or `false` |
| `shardSize` | | Split the index into files of about this many sections |
| `keepPagefind` | `false` | Starlight plugin only: keep Pagefind as well |

The other options (`exclude`, `maxChars`, `code`, `vectorBits`, ...) are those of the [Vite plugin](./vite.md).

## Limits

- Tested with Astro 7.3 and Starlight 0.42; older Astro versions are not tested.
- Only content below `docs` is indexed, not pages written as `.astro` files.
- Cosine's field replaces Starlight's modal dialog; on narrow screens it shares the header with the site title.
- Verified with real `astro build` and `astro dev` runs and the generated HTML. Not verified in a real browser.
