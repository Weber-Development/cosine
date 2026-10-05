---
title: Cosine Pro
description: A Vite plugin that builds the index with every build, and search insights that show what your docs are missing.
---

Cosine Pro adds what you need once search runs on more than one site: the index builds itself, and you see what people look for and do not find.

| Package | What it does |
|---|---|
| [`@weber-development/cosine-vite`](vite.md) | Builds the index in every Vite build (Astro, VitePress, SvelteKit, Nuxt), serves it in dev, rebuilds on change and re-embeds only the sections that changed |
| [`@weber-development/cosine-insights`](insights.md) | Records searches without tracking people and reports queries without results, results nobody opened and the most searched topics |

## Licence and plans

Plans and prices are on [packages.sweber.dev/cosine](https://packages.sweber.dev/cosine). After cancelling a subscription, the versions you installed keep working; only updates and access to new versions end.

## Installation

The packages are delivered through GitHub Packages. After purchase you get read access to the repository `Weber-Development/cosine-pro-dist`, which contains the full installation guide. In short:

```ini title=".npmrc"
@weber-development:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${COSINE_PRO_TOKEN}
```

```sh
npm i @sweberdev/cosine @huggingface/transformers @weber-development/cosine-insights
npm i -D @weber-development/cosine-vite
```
