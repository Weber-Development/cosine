---
title: Short answers
description: Show the sentence that answers the question above the search results, without an LLM and without a server.
---

`@weber-development/cosine-answers` reads the top results of a search, picks the sentence that best answers the question and shows it with a link to the page. It runs in the browser, needs no account or API key and gives the same answer every time.

```sh
npm i @weber-development/cosine-answers
```

## Add it to the search element

```html
<cosine-search id="search" index="/cosine/cosine-index.json"></cosine-search>
<div id="answer" hidden></div>

<script type="module">
  import "@sweberdev/cosine/element";
  import { attachAnswer } from "@weber-development/cosine-answers";

  attachAnswer(document.getElementById("search"), document.getElementById("answer"), {
    maxLength: 280,
    minConfidence: 0.5,
  });
</script>
```

`attachAnswer` returns a function that removes the listener again.

## Use the functions directly

```ts
import { findAnswer, renderAnswer } from "@weber-development/cosine-answers";

const answer = findAnswer(query, results); // results from cosine.search(query)
if (answer) target.innerHTML = renderAnswer(answer);
```

`findAnswer` returns `{ text, url, title, heading, confidence, matched }` or `null`. Options: `maxLength` (280), `minConfidence` (0.5) and `labels: { readMore }`.

## When you get no answer

You get `null` when confidence is below `minConfidence`, when fewer than half of the question's words are covered, or when two different pages answer about equally well. Nothing is better than a wrong answer.

The answer is extractive: it quotes your docs and never rewrites them. If no page states the answer in one or two sentences, there is none. Only the top three results are read.

`renderAnswer` escapes all text and only links relative, `http` and `https` URLs. Style it with `.cosine-answer`, `.cosine-answer-text` and `.cosine-answer-link`.
