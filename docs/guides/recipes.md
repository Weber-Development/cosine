---
title: Recipes
description: Short setups for Next.js, Astro, VitePress, Docusaurus, SvelteKit, Vue and plain HTML.
---

Every recipe has the same two steps: build the index into a folder that the site serves as `/cosine/`, then add the search field. Install first:

```sh
npm i @sweberdev/cosine @huggingface/transformers
```

The index URL is always an absolute path such as `/cosine/cosine-index.json`. If your site lives below a base path, include it, see [Troubleshooting](troubleshooting.md#results-link-to-the-wrong-page-or-the-index-is-not-found).

## Next.js

With a static export (`output: "export"`), index the exported HTML after the build:

```json title="package.json"
{
  "scripts": {
    "build": "next build && cosine build out --out out/cosine"
  }
}
```

```tsx title="components/search.tsx"
"use client";

import { CosineSearch } from "@sweberdev/cosine-react";
import { useRouter } from "next/navigation";

export function Search() {
  const router = useRouter();
  return (
    <CosineSearch
      index="/cosine/cosine-index.json"
      onSelect={(result) => {
        router.push(result.chunk.url);
        return false;
      }}
    />
  );
}
```

Install `@sweberdev/cosine-react` as well, see [React](react.md). For sites that are not exported, [`cosine-next`](../pro/next.md) (Cosine Pro) reads the prerendered pages in `.next` and caches the index between builds.

## Astro

```json title="package.json"
{
  "scripts": {
    "build": "astro build && cosine build dist --out dist/cosine"
  }
}
```

```astro title="src/components/Search.astro"
<cosine-search index="/cosine/cosine-index.json"></cosine-search>

<script>
  import "@sweberdev/cosine/element";
</script>
```

The Pro plugin [`cosine-vite`](../pro/vite.md) builds the index inside the Astro build and serves it in dev.

## VitePress

Index the Markdown sources. Folders that start with a dot, such as `.vitepress`, are skipped. Set `cleanUrls: true` in the VitePress config, so the page URLs match.

```json title="package.json"
{
  "scripts": {
    "docs:build": "cosine build docs --out docs/public/cosine && vitepress build docs"
  }
}
```

```ts title="docs/.vitepress/theme/index.ts"
import DefaultTheme from "vitepress/theme";
import { h } from "vue";

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      "nav-bar-content-before": () => h("cosine-search", { index: "/cosine/cosine-index.json" }),
    });
  },
  async enhanceApp() {
    if (!import.meta.env.SSR) await import("@sweberdev/cosine/element");
  },
};
```

If the site has a `base`, build with `--base-url /base/` and use `/base/cosine/cosine-index.json` as the index.

## Docusaurus

```json title="package.json"
{
  "scripts": {
    "build": "docusaurus build && cosine build build --out build/cosine"
  }
}
```

Swizzle the search bar and render the element on the client only:

```jsx title="src/theme/SearchBar/index.js"
import React from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";

export default function SearchBar() {
  return (
    <BrowserOnly>
      {() => {
        require("@sweberdev/cosine/element");
        return <cosine-search index="/cosine/cosine-index.json" />;
      }}
    </BrowserOnly>
  );
}
```

During `docusaurus start` the index does not exist yet. Run `cosine build build --out static/cosine` once after a build to try the search in dev.

## SvelteKit

With `adapter-static`:

```json title="package.json"
{
  "scripts": {
    "build": "vite build && cosine build build --out build/cosine"
  }
}
```

```svelte title="src/routes/+layout.svelte"
<script>
  import { onMount } from "svelte";

  onMount(() => import("@sweberdev/cosine/element"));
</script>

<cosine-search index="/cosine/cosine-index.json"></cosine-search>
<slot />
```

## Vue (Vite)

Build the index from your Markdown before the Vite build and tell Vue that `cosine-search` is a custom element:

```json title="package.json"
{
  "scripts": {
    "prebuild": "cosine build content --out public/cosine --base-url /docs"
  }
}
```

```ts title="vite.config.ts"
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === "cosine-search" } } }),
  ],
});
```

```vue title="src/App.vue"
<script setup lang="ts">
import "@sweberdev/cosine/element";

function onSelect(event: CustomEvent) {
  event.preventDefault(); // handle navigation with your router
  console.log(event.detail.chunk.url);
}
</script>

<template>
  <cosine-search index="/cosine/cosine-index.json" @cosine-select="onSelect" />
</template>
```

## Plain HTML

```sh
npx cosine build site --out site/cosine
```

```html
<script type="module">
  import "@sweberdev/cosine/element";
</script>
<cosine-search index="/cosine/cosine-index.json"></cosine-search>
```

The bare specifier `@sweberdev/cosine/element` needs a bundler (Vite, esbuild, webpack) or an import map that points to a copy of the package you serve yourself.
