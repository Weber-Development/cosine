---
title: Building the index
description: What cosine build reads, how it splits pages and how to run it in CI.
---

## Sources

`cosine build <dir>` reads these files recursively, skipping folders that start with `.` and `node_modules`:

| File | Read as |
|---|---|
| `.md`, `.mdx`, `.markdown` | Markdown. The page title comes from `title` in the front matter or the first `#` heading. MDX `import`/`export` lines and JSX tags are dropped. |
| `.html`, `.htm` | The `<main>` element (or `<article>`, or `<body>`). Navigation, header, footer, scripts and elements with `data-cosine-ignore` are dropped. Pages with `<meta name="robots" content="noindex">` are skipped. |
| `.txt` | Plain text. |

URLs follow the file path: `guides/cli.md` with `--base-url /docs` becomes `/docs/guides/cli`, `index.md` becomes `/docs/`.

## Chunks

Every page is split at `##`, `###` and `####` headings. Each section becomes one search result that links straight to the heading anchor (GitHub style, or a custom `{#id}`). Sections longer than `--max-chars` (default 1200) are split at paragraphs.

The model sees each chunk together with its page title and heading path, e.g. `Billing > Invoices`, so short sections still have context.

## Options

| Option | Default | |
|---|---|---|
| `--out <dir>` | `public/cosine` | Output directory |
| `--base-url <path>` | `/` | URL prefix of the pages |
| `--model <id>` | `english` | `english`, `multilingual` or a Hugging Face model id, see [Models](models.md) |
| `--lexical-only` | | No vectors, keyword search only |
| `--exclude <path>` | | Skip files whose relative path starts with this (repeatable) |
| `--max-chars <n>` | `1200` | Soft maximum chunk length |

## In CI

Building downloads the model once (about 23 MB). Cache it between runs:

```yaml
- uses: actions/cache@v4
  with:
    path: node_modules/@huggingface/transformers/.cache
    key: cosine-model
- run: npx cosine build docs --out public/cosine --base-url /docs
```

## From code

```ts
import { transformersEmbedder } from "@sweberdev/cosine";
import { buildDirectory } from "@sweberdev/cosine/node";

await buildDirectory("docs", "public/cosine", {
  baseUrl: "/docs",
  embedder: transformersEmbedder({ model: "english" }),
  exclude: ["drafts/"],
});
```

`buildIndex(documents, options)` from `@sweberdev/cosine` takes documents from anywhere (a CMS, a database) and also runs in the browser.
