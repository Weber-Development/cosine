---
title: Next.js
description: Build the index from the pages next build has prerendered, and keep it fast in CI.
---

`@weber-development/cosine-next` builds the search index from the finished HTML of your Next.js site. Run it after `next build`:

```json title="package.json"
{
  "scripts": {
    "build": "next build && cosine-next --base-path /docs"
  }
}
```

```tsx
import "@sweberdev/cosine/element";

export function Search() {
  return <cosine-search index="/cosine/cosine-index.json" />;
}
```

## What it reads

- After `output: "export"`: the `out/` folder.
- Otherwise: the prerendered pages in `.next/server/app` and `.next/server/pages`. These exist for every static page and every page with `generateStaticParams`. Pages that only render on request have no HTML at build time and are not indexed.

Next's error pages (`404`, `500`, `_not-found`) are skipped, and so are pages with `<meta name="robots" content="noindex">`. Like the free CLI, Cosine reads the `<main>` element, so navigation and footers stay out of the results. Mark other elements with `data-cosine-ignore`.

The index is written to `public/cosine`, which Next serves from `/cosine/`. Use `--base-path` when your site has a `basePath`.

## Fast rebuilds

The last index is kept in `.next/cache/cosine`. The next build embeds only sections whose text changed and takes the rest from there. Vercel and most CI setups keep `.next/cache` between builds, so a typo fix does not embed the whole site again. `--no-cache` embeds everything.

## Options

| Option | Default | |
|---|---|---|
| `--source <dir>` | `out`, else `.next/server/app` | Folder with the HTML, repeatable |
| `--out <dir>` | `public/cosine` | Output directory |
| `--base-path <path>` | `/` | `basePath` of the site |
| `--model <id>` | `english` | `english`, `multilingual` or a Hugging Face model id |
| `--lexical-only` | | No embeddings, keyword search only |
| `--exclude <path>` | | Skip pages whose path starts with this, repeatable |
| `--cache-dir <dir>` | `.next/cache/cosine` | Where the last index is kept |
| `--no-cache` | | Embed everything every time |
| `--config <file>` | | JSON file with more options, e.g. `{ "synonyms": [["login", "sign-in"]], "boost": { "/docs/api": 1.5 } }` |

From code: `buildNextIndex({ baseUrl: "/docs", exclude: ["blog/"] })`.
