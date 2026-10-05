---
title: Vite plugin
description: Build the index as part of every Vite build, with a dev server and an embedding cache.
---

`@weber-development/cosine-vite` replaces the `cosine build` step. The index is always in sync with the docs, also in `vite dev`.

```ts title="vite.config.ts"
import cosine from "@weber-development/cosine-vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [cosine({ docs: "docs", baseUrl: "/docs" })],
});
```

```ts
import "@sweberdev/cosine/element";
import { indexUrl } from "virtual:cosine";

document.querySelector("cosine-search")?.setAttribute("index", indexUrl);
```

For TypeScript, add `"types": ["@weber-development/cosine-vite/client"]` to `tsconfig.json`.

## What it does

- **Build:** writes `cosine/cosine-index.json` and `cosine/cosine-vectors.bin` into the output folder. In tools that run a server and a client build (Astro, SvelteKit) the files go to the client build.
- **Dev:** serves the index from memory and rebuilds it when a file in `docs` changes. The browser receives the Vite event `cosine:update`.
- **Cache:** vectors are stored in `node_modules/.cache/cosine/embeddings.json` by section text. A rebuild after editing one page embeds only that page's changed sections. Cache that folder in CI to make builds fast.

## Frameworks

```js title="astro.config.mjs"
import cosine from "@weber-development/cosine-vite";
export default defineConfig({ vite: { plugins: [cosine({ docs: "src/content/docs", baseUrl: "/" })] } });
```

```ts title=".vitepress/config.ts"
import cosine from "@weber-development/cosine-vite";
export default defineConfig({ vite: { plugins: [cosine({ docs: ".", baseUrl: "/", exclude: ["node_modules", ".vitepress"] })] } });
```

## Options

| Option | Default | |
|---|---|---|
| `docs` | | Folder with the pages, relative to the Vite root |
| `baseUrl` | `/` | URL prefix of the pages |
| `model` | `english` | `english`, `multilingual`, a model id, or `false` for keyword search only |
| `embedder` | | Custom embedder instead of `model` |
| `outDir` | `cosine` | Folder of the index below the site base |
| `cacheFile` | `node_modules/.cache/cosine/embeddings.json` | Embedding cache, or `false` |
| `exclude` | | Paths below `docs` to skip |
| `maxChars`, `code`, `minLevel`, `maxLevel` | | Chunking, as in [Building the index](../guides/indexing.md) |

`cachedEmbedder(embedder, file)` is exported too, for your own build scripts.
