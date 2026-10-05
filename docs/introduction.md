---
title: Why Cosine
description: Search documentation by meaning, in the browser, without a search server or API key.
---

Most documentation search either needs a hosted service (Algolia DocSearch, Typesense, a vector database) or matches only exact words (Pagefind, Lunr, FlexSearch). Someone who types "how do I get rid of the app" finds nothing on a page titled "Uninstall".

Cosine closes that gap without a server:

- **Index at build time.** `cosine build` splits your Markdown, MDX or built HTML into sections and stores a small vector for each section next to your site, e.g. in `public/cosine/`.
- **Search in the browser.** The visitor's browser compares the query with these vectors (cosine similarity, hence the name). The model runs locally through [transformers.js](https://huggingface.co/docs/transformers.js).
- **Instant first, smart second.** Keyword results show up on the first keystroke. The model (about 23 MB, cached by the browser) loads in the background when the search field gets focus, and the ranking improves as soon as it is ready. Visitors with "save data" turned on keep keyword search.
- **Typo-tolerant.** A word that is not in the index also finds close spellings, so `instalation` still finds the installation guide, even before the model has loaded.
- **Hybrid ranking.** Keyword and semantic results are combined with reciprocal rank fusion, so exact API names still win where they should.
- **Accessible search field.** `<cosine-search>` is an ARIA combobox that works with keyboard and screen readers, in English, German, French and Italian. React hooks are available too.

## What it costs

| | Size |
|---|---|
| Library (search + web component) | about 7 KB gzip |
| Index for 100 pages (about 400 sections) | about 160 KB vectors + the text |
| Model, English (default) | about 23 MB, loaded once, then from the browser cache |
| Model, multilingual | about 120 MB, recommended only when queries and pages use different languages |

## Privacy

Queries never leave the browser. The only outside request is the model download, from Hugging Face by default, or from your own server. See [Privacy and self-hosting](guides/privacy.md).

## When not to use Cosine

- Tens of thousands of pages: the index then gets too big for the browser. Use a search server.
- Search across content that changes every minute: Cosine indexes at build time.
