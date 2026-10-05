# Cosine

Semantic search for documentation sites that runs entirely in the browser. Build the index once, search with keywords on the first keystroke and by meaning as soon as the model has loaded. No search server, no API key, no query ever leaves the browser.

| Package | What it does |
|---|---|
| [`@sweberdev/cosine`](packages/core) | Index builder and CLI, hybrid search (BM25 + cosine similarity on embeddings), `<cosine-search>` web component |
| [`@sweberdev/cosine-react`](packages/react) | `<CosineSearch>`, `useCosine`, `useCosineSearch` |

Docs and live demo: [packages.sweber.dev/cosine](https://packages.sweber.dev/cosine).

## Quick start

```sh
npm i @sweberdev/cosine @huggingface/transformers
npx cosine build docs --out public/cosine --base-url /docs
```

```html
<script type="module">
  import "@sweberdev/cosine/element";
</script>
<cosine-search index="/cosine/cosine-index.json"></cosine-search>
```

Someone who types "how do I get rid of the app" now finds your "Uninstall" section, even though no word matches.

## How it works

1. `cosine build` splits Markdown, MDX or HTML pages at their headings and embeds each section with a small sentence model ([all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) by default, or a multilingual one). Vectors are stored as int8: about 400 bytes per section.
2. In the browser, keyword search (BM25 with prefix matching) answers immediately.
3. When the search field gets focus, the same model loads through [transformers.js](https://huggingface.co/docs/transformers.js) (about 23 MB, cached). From then on the query is embedded locally and both rankings are fused.

## Development

```sh
pnpm install
pnpm build && pnpm test
COSINE_E2E=1 pnpm test   # also runs the real model (downloads about 23 MB)
```

## Licence

MIT. Cosine Pro (build integrations and search insights) is a separate commercial package, see [packages.sweber.dev/cosine](https://packages.sweber.dev/cosine).
