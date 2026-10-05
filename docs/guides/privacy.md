---
title: Privacy and self-hosting
description: What leaves the browser, and how to serve the model from your own domain.
---

## What leaves the browser

- **Queries: nothing.** Search runs entirely on the visitor's device. There is no search API and no tracking.
- **The index** is loaded from your own site.
- **The model** is downloaded from `huggingface.co` the first time the search field gets focus, then served from the browser cache. This request reveals the visitor's IP address to Hugging Face, like any third-party asset.

If that request is a problem under the GDPR or the Swiss FADP for your site, serve the model yourself.

## Serving the model from your own domain

Copy the model files (`config.json`, `tokenizer.json`, `tokenizer_config.json`, `onnx/model_quantized.onnx`) from the [model page](https://huggingface.co/Xenova/all-MiniLM-L6-v2/tree/main) to e.g. `public/models/Xenova/all-MiniLM-L6-v2/`, then point transformers.js there:

```ts
import { Cosine, loadIndex, transformersEmbedder } from "@sweberdev/cosine";

const embedder = transformersEmbedder({
  model: "english",
  load: async () => {
    const transformers = await import("@huggingface/transformers");
    transformers.env.allowRemoteModels = false;
    transformers.env.localModelPath = "/models/";
    return transformers;
  },
});
const cosine = await loadIndex("/cosine/cosine-index.json", { embedder });
document.querySelector("cosine-search").cosine = cosine;
```

The ONNX runtime itself (WebAssembly) is loaded from a CDN by transformers.js; set `transformers.env.backends.onnx.wasm.wasmPaths` to serve it yourself as well.

## Keyword search only

`<cosine-search load-model="never">` or an index built with `--lexical-only` never contacts a third party.
