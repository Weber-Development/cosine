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

<!-- pro-promo -->
## Cosine Pro

Need more than the free package? **Cosine Pro** adds:

- Vite plugin: builds the index with every build, serves it in dev, re-embeds only changed sections
- Search insights: queries without results and results nobody opened, without cookies or ids
- Golden-query tests for CI: fail when a regression moves the right page down

Subscriptions from CHF 12 per month, or a one-time lifetime licence. [See what is included](https://packages.sweber.dev/cosine?utm_source=npm&utm_medium=readme&utm_campaign=pro)
