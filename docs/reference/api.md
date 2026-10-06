---
title: JavaScript API
description: loadIndex, Cosine, buildIndex and the helpers.
---

## Browser

### `loadIndex(url, options?)`

Loads `cosine-index.json` and the vector file next to it and returns a `Cosine` instance.

| Option | Default | |
|---|---|---|
| `loadModel` | `lazy` | `lazy` loads the model on `warmup()` or the first search (not when the browser asks to save data), `eager` right away, `never` not at all |
| `embedder` | from the index | Your own `Embedder`, or `false` for keyword search only |
| `minSimilarity` | from the index | Drop semantic hits below this cosine similarity |
| `synonyms` | from the index | Synonym groups, e.g. `[["login", "sign-in"]]`, replacing the ones stored in the index |
| `fetch` | `globalThis.fetch` | Custom fetch |

### `Cosine`

| Member | |
|---|---|
| `search(query, options?)` | `Promise<SearchResult[]>`. `mode`: `hybrid` (default; keyword results until the model is ready, does not wait), `lexical`, `semantic` (waits for the model). `limit` (8), `groupByPage` (false), `scope` (URL paths to search in, a string or an array) |
| `searchLexical(query, options?)` | Synchronous keyword search |
| `warmup()` | Loads the model. Never rejects; on failure `status` becomes `model-failed` |
| `status` | `lexical`, `loading-model`, `ready`, `model-failed` |
| `onStatus(listener)` | Subscribe to status changes, returns an unsubscribe function |
| `chunks` | All chunks of the index |

### `SearchResult`

```ts
interface SearchResult {
  chunk: { id: number; doc: string; url: string; title: string; headings: string[]; text: string };
  score: number;
  matchedBy: Array<"lexical" | "semantic">;
  snippet: string;
  highlights: Array<[start: number, end: number]>; // ranges in snippet
}
```

`highlightParts(snippet, highlights)` splits a snippet into `{ text, match }` parts for rendering.

## Build (Node and browser)

| Function | |
|---|---|
| `buildIndex(documents, options)` | Chunks and embeds `{ id, url, title, content }` documents. Returns `{ manifest, vectors, reused, embedded }`. `synonyms` stores synonym groups in the index, `previous` (`{ manifest, vectors }` of the last build) reuses the vectors of unchanged sections |
| `transformersEmbedder(options)` | Embedder on top of transformers.js. `model` (`english`, `multilingual` or an id), `dtype` (`q8`), `device`, `queryPrefix`, `passagePrefix`, `load`, `onProgress` |
| `chunkMarkdown(document, options)` | Splits one Markdown page into chunks |
| `htmlToMarkdown(html)` | Extracts the main content of an HTML page |

From `@sweberdev/cosine/node`: `readDocs(dir, options)`, `writeIndex(index, outDir)`, `buildDirectory(dir, outDir, options)`, `readIndex(dir)` (the last build, for `previous`), `loadIndexFile(path, options)`.

## Custom embedder

Anything with this shape works, e.g. a call to your own embedding API at build time:

```ts
interface Embedder {
  model: string;
  embed(texts: string[], kind: "query" | "passage"): Promise<Float32Array[]>;
}
```
