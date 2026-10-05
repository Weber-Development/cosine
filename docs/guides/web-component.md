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
| `index` | | URL of `cosine-index.json` |
| `lang` | page language | `en`, `de`, `fr` or `it` for the built-in texts |
| `placeholder`, `label` | from `lang` | Custom texts |
| `limit` | `8` | Number of results |
| `shortcut` | `/` | `/`, `mod+k` (Ctrl K / ⌘K) or `none` |
| `mode` | `hybrid` | `lexical` never loads the model |
| `load-model` | `lazy` | `lazy` (on focus), `eager` (right away), `never` |
| `scope` | whole index | Space-separated URL paths to search in, e.g. `/docs/api /docs/guides` |

`scope` matches whole path segments: `/docs/api` covers `/docs/api/auth`, but not `/docs/apis`. Use it for a search field that only covers one section, such as the API reference.

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
