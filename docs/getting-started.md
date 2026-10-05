---
title: Getting started
description: Build an index, add the search field, done.
---

## 1. Install

```sh
npm i @sweberdev/cosine @huggingface/transformers
```

`@huggingface/transformers` runs the model, both when you build the index and in the browser. Skip it for a keyword-only index (`--lexical-only`).

## 2. Build the index

Point Cosine at your docs. It reads `.md`, `.mdx`, `.html` and `.txt` files recursively.

```sh
npx cosine build docs --out public/cosine --base-url /docs
```

```text
Indexed 42 pages as 186 chunks in 9.3 s with Xenova/all-MiniLM-L6-v2 (71 KB vectors)
  public/cosine/cosine-index.json
  public/cosine/cosine-vectors.bin
```

Run it before every deploy, e.g. as `"prebuild": "cosine build docs --out public/cosine --base-url /docs"` in `package.json`. For a static site generator you can also index the built HTML: `cosine build dist --out dist/cosine`.

Try a query in the terminal:

```sh
npx cosine search public/cosine "how do I remove the app"
```

## 3. Add the search field

```html
<script type="module">
  import "@sweberdev/cosine/element";
</script>

<cosine-search index="/cosine/cosine-index.json"></cosine-search>
```

That is all. Press <kbd>/</kbd> to focus the field. In React use [`<CosineSearch>`](guides/react.md); for your own UI use the [JavaScript API](reference/api.md).

## Next steps

- [Models and languages](guides/models.md): German, French or Italian docs.
- [Styling the search field](guides/web-component.md).
- [Privacy and self-hosting the model](guides/privacy.md).
