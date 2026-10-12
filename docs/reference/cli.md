---
title: CLI
description: cosine build and cosine search.
---

```text
cosine build <docs-dir> [options]     Build a search index from Markdown, MDX and HTML files
cosine search <index-dir> <query>     Try a query against a built index
```

## cosine build

| Option | Default | |
|---|---|---|
| `--out <dir>` | `public/cosine` | Output directory |
| `--base-url <path>` | `/` | URL prefix of the pages |
| `--model <id>` | `english` | `english`, `multilingual` or a Hugging Face model id |
| `--lexical-only` | | No embeddings, keyword search only (no model download) |
| `--exclude <path>` | | Skip files whose path starts with this (repeatable) |
| `--max-chars <n>` | `1200` | Soft maximum chunk length |
| `--query-prefix <s>` | | Prefix for queries (custom E5/BGE models) |
| `--passage-prefix <s>` | | Prefix for passages (custom E5/BGE models) |
| `--boost <path=n>` | | Rank results below a path higher (n above 1) or lower (below 1), repeatable, e.g. `--boost /docs/api=1.5 --boost /blog=0.7` |
| `--synonyms <file>` | | JSON file with synonym groups, see [Building the index](../guides/indexing.md#synonyms) |
| `--incremental` | | Reuse the vectors of the index in `--out`, embed only new and changed sections |
| `--shard-size <n>` | | Split the index into files of about n sections (whole pages stay together). The browser loads them in parallel and unchanged shards stay cached, see [Large sites](../guides/indexing.md#large-sites) |
| `--vector-bits <n>` | `8` | `4` halves the vector file at a small cost in ranking quality |

Writes `cosine-index.json` (format 2: chunks and settings) and `cosine-vectors.bin` (int8 vectors, or 4-bit with `--vector-bits 4`) to the output directory.

## cosine search

| Option | Default | |
|---|---|---|
| `--mode <mode>` | `hybrid` | `hybrid`, `lexical` or `semantic` |
| `--limit <n>` | `5` | Number of results |

Exit code 0 on success, 1 on errors.
