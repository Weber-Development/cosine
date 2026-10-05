# @sweberdev/cosine

Semantic docs search that runs in the browser: index builder, CLI, hybrid search and the `<cosine-search>` web component.

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

Docs: [packages.sweber.dev/cosine/docs](https://packages.sweber.dev/cosine/docs). MIT licence.
