---
"@sweberdev/cosine": major
"@sweberdev/cosine-react": major
---

Cosine 2.0. Index format 2 is smaller (page titles and URLs are stored once), can be split into shards (`--shard-size`) and can use 4-bit vectors (`--vector-bits 4`); format 1 is still read, with a warning. Chinese, Japanese, Thai and other scripts without spaces are split into words, so they can be searched and highlighted. New build integrations: `@sweberdev/cosine/astro` (Starlight too), `/docusaurus` and `/vitepress`. `Embedder`, `transformersEmbedder` and `DEFAULT_MODEL` are stable. Node 22 or later is required. Browser tests also run in Firefox and WebKit. See "Migrating to 2.0" in the docs.
