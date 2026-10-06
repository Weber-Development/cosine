---
"@sweberdev/cosine": minor
"@sweberdev/cosine-react": minor
---

Several indexes and filter buttons. `<cosine-search index="/docs/cosine-index.json /blog/cosine-index.json">` searches several indexes as one and merges the results by rank (`loadIndexes()` and `CosineGroup` in code, with optional weights). The new `facets` attribute shows filter buttons per section of the site with result counts. `CosineSearch` for React takes an array for `index` and a `facets` prop. New texts for the buttons in English, German, French and Italian.
