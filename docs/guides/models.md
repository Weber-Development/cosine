---
title: Models and languages
description: Which embedding model to choose for English, German, French or Italian documentation.
---

The index and the browser must use the same model. Cosine stores the model id in `cosine-index.json` and loads it automatically in the browser.

| `--model` | Model | Size (q8) | Use when |
|---|---|---|---|
| `english` (default) | `Xenova/all-MiniLM-L6-v2` | about 23 MB | Docs and queries in English |
| `multilingual` | `Xenova/multilingual-e5-small` | about 120 MB | Docs in German, French or Italian, or queries in another language than the docs |

Keyword search works in every language either way. Accents and `ß` are folded, so `Grösse`, `Größe` and `grosse` match.

## German docs with the English model?

It works for words shared between the languages (product names, API names, technical terms), but semantic matches for German phrases are weaker. If most visitors search in German, use `multilingual`. Because the model loads only when the search field gets focus, the larger download does not slow down the page.

## Other models

Any [feature-extraction model with ONNX weights](https://huggingface.co/models?library=transformers.js&pipeline_tag=feature-extraction) works. E5 and BGE models expect prefixes:

```sh
npx cosine build docs --model Xenova/bge-small-en-v1.5 --query-prefix "Represent this sentence for searching relevant passages: "
```

## Relevance threshold

Semantic hits below a minimum cosine similarity are dropped so that nonsense queries find nothing. The English preset uses 0.2. Set your own when loading:

```ts
const cosine = await loadIndex("/cosine/cosine-index.json", { minSimilarity: 0.3 });
```
