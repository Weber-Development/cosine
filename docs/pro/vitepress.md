---
title: VitePress
description: Replace the VitePress search with Cosine: index in dev and build, one model per locale, no server.
---

`@weber-development/cosine-vitepress` puts `<cosine-search>` where the built-in VitePress search normally sits and builds the index as part of `vitepress dev` and `vitepress build`. It works with VitePress 1.x and its locales.

```sh
pnpm add -D @weber-development/cosine-vitepress @sweberdev/cosine @huggingface/transformers
```

## Setup

```ts title=".vitepress/config.ts"
import { defineConfig } from "vitepress";
import { withCosine } from "@weber-development/cosine-vitepress";

export default withCosine(defineConfig({ title: "My docs", base: "/docs/" }), {
  model: "english",
});
```

```ts title=".vitepress/theme/index.ts"
import Theme from "@weber-development/cosine-vitepress/theme";
export default Theme;
```

The theme extends the default theme. The field sits in the nav bar (slot `nav-bar-content-before`) and in the mobile menu. The index lands in `.vitepress/dist/cosine/` and is served at `<base>cosine/` in dev. Embeddings are cached in `node_modules/.cache/cosine`, so a rebuild only embeds changed pages.

`themeConfig.search` (local search or Algolia) is removed with a warning so only one field shows. Pass `keepBuiltInSearch: true` to keep it.

## Options

| Option | Default | Meaning |
|---|---|---|
| `model` | `english` | Model of a site without locales, or `false` for keyword search |
| `models` | | Model per locale key, e.g. `{ root: "english", de: "multilingual" }` |
| `exclude` | `node_modules`, `public` | Folders below `srcDir` that are not docs |
| `shardSize`, `outDir`, `cacheFile`, `synonyms`, ... | | As in the [Vite plugin](./vite.md) |
| `ui` | | `placeholder`, `shortcut` (`mod+k`), `facets`, `limit`, `mode`, `loadModel` |

The colours come from the `--vp-c-*` variables, so the field follows light and dark mode.

## Locales

With two or more `locales`, each locale gets its own index and model:

```ts
export default withCosine(
  defineConfig({
    locales: {
      root: { label: "English", lang: "en-US" },
      de: { label: "Deutsch", lang: "de-DE", link: "/de/" },
    },
  }),
  { models: { root: "english", de: "multilingual" } },
);
```

`models` uses the VitePress locale keys (`root` is the default locale). The language code is the base of `lang` (`de-DE` becomes `de`). A page belongs to the locale of its folder. The browser downloads only the index and model of the language the visitor reads, and switches when the locale changes. See [Languages](./i18n.md).

## Limits

- Tested with VitePress 1.6.4 in real builds and a dev server, not in a real browser.
- `srcExclude` is not read, use `exclude`.
- The index is built from the Markdown source, not from the rendered page.
- VitePress 2 (alpha) is not supported.
