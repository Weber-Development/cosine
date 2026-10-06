---
title: Search field
description: The <cosine-search> web component, its attributes, styling and events.
---

```html
<script type="module">
  import "@sweberdev/cosine/element";
</script>

<cosine-search index="/cosine/cosine-index.json" lang="de" shortcut="mod+k"></cosine-search>
```

It works in any framework or none: Astro, VitePress, Docusaurus, Hugo, Eleventy, plain HTML.

## Attributes

| Attribute | Default | |
|---|---|---|
| `index` | | URL of `cosine-index.json`, or several separated by spaces to search them as one, see [Several indexes](#several-indexes) |
| `lang` | page language | `en`, `de`, `fr` or `it` for the built-in texts |
| `placeholder`, `label` | from `lang` | Custom texts |
| `limit` | `8` | Number of results |
| `shortcut` | `/` | `/`, `mod+k` (Ctrl K / ⌘K) or `none` |
| `mode` | `hybrid` | `lexical` never loads the model |
| `load-model` | `lazy` | `lazy` (on focus), `eager` (right away), `never` |
| `facets` | off | Shows filter buttons per section of the site with the number of results. `facets="2"` uses two path segments (`/docs/guides`) |
| `scope` | whole index | Space-separated URL paths to search in, e.g. `/docs/api /docs/guides` |

`scope` matches whole path segments: `/docs/api` covers `/docs/api/auth`, but not `/docs/apis`. Use it for a search field that only covers one section, such as the API reference.

## Search syntax

Visitors can narrow a search without any setup:

| Query | Finds |
|---|---|
| `"reset password"` | Sections that contain these words next to each other, in this order |
| `webhook -retry` | Sections about webhooks that do not contain `retry` |
| `sign-in`, `e-mail` | Normal words: only a `-` at the start of a word excludes |

Phrases and exclusions apply in every mode, also to the results of the semantic ranking. Small words such as `the` do not break a phrase. Accents and case are ignored, like everywhere else.

## Filters by section

Add the `facets` attribute and the dropdown shows a button per section of the site (`docs (7)`, `blog (3)`), plus `All`. A click limits the results to that section. With a single section there is nothing to filter, so the buttons stay hidden. Style them with `::part(facets)`.

```html
<cosine-search index="/cosine/cosine-index.json" facets></cosine-search>
```

For your own search page, use the API:

`cosine.facets(query)` counts the results per section of the site, so your own search page can offer filters and use the chosen path as `scope`:

```ts
const facets = await cosine.facets("webhook", { depth: 2 });
// [{ path: "/docs/guides", count: 7 }, { path: "/docs/api", count: 3 }]
const results = await cosine.search("webhook", { scope: facets[0].path });
```

## Several indexes

One site, several sources: the docs, the blog, a help center. Build an index for each and list them in `index`; Cosine searches them as one and merges the results by rank.

```html
<cosine-search index="/docs/cosine-index.json /blog/cosine-index.json" facets></cosine-search>
```

In code, `loadIndexes(urls, { weights })` returns a `CosineGroup` with the same `search`, `searchLexical`, `facets`, `warmup` and `onStatus` as `Cosine`. `weights` ranks an index higher, e.g. `{ weights: [2, 1] }` puts the docs first. Every index must be built with the same model, which `cosine build` does by default. Each result has an `index` field with the position of its index.

## Accessibility

The field follows the ARIA combobox pattern: arrow keys move through the results, <kbd>Enter</kbd> opens one, <kbd>Esc</kbd> closes the list and then clears the field. The number of results is announced to screen readers, matches are marked with `<mark>`, and animations respect reduced motion.

## Styling

Custom properties:

```css
cosine-search {
  --cosine-accent: #d4380d;
  --cosine-bg: #fff;
  --cosine-text: #111;
  --cosine-muted: #555;
  --cosine-border: #ddd;
  --cosine-radius: 6px;
  --cosine-max-height: 70vh;
  --cosine-z: 100;
}
```

For more control, style the parts: `::part(input)`, `::part(results)`, `::part(result)`, `::part(result-title)`, `::part(result-snippet)`, `::part(status)`, `::part(shortcut)`.

## Events

`cosine-select` fires before navigating, with the `SearchResult` as `detail`. Call `preventDefault()` to navigate yourself, e.g. with a client-side router:

```js
document.querySelector("cosine-search").addEventListener("cosine-select", (event) => {
  event.preventDefault();
  router.push(event.detail.chunk.url);
});
```
