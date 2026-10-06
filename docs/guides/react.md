---
title: React
description: The CosineSearch component and the useCosine / useCosineSearch hooks.
---

```sh
npm i @sweberdev/cosine-react @huggingface/transformers
```

## Component

```tsx
import { CosineSearch } from "@sweberdev/cosine-react";
import { useRouter } from "next/navigation";

export function DocsSearch() {
  const router = useRouter();
  return (
    <CosineSearch
      index="/cosine/cosine-index.json"
      lang="de"
      shortcut="mod+k"
      onSelect={(result) => {
        router.push(result.chunk.url);
        return false; // Cosine does not navigate itself
      }}
    />
  );
}
```

`CosineSearch` renders the [`<cosine-search>`](web-component.md) web component, so attributes, styling and accessibility are the same. `scope` takes a string or an array, e.g. `scope={["/docs/api", "/docs/guides"]}`, and so does `index`, to search several indexes as one: `index={["/docs/cosine-index.json", "/blog/cosine-index.json"]}`. `facets` shows the filter buttons per section.

## Hooks for your own UI

```tsx
import { useCosine, useCosineSearch } from "@sweberdev/cosine-react";
import { useState } from "react";

export function Search() {
  const { cosine, status } = useCosine("/cosine/cosine-index.json");
  const [query, setQuery] = useState("");
  const { results } = useCosineSearch(cosine, query, { limit: 5, groupByPage: true, scope: "/docs" });

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => cosine?.warmup()} />
      {status === "loading-model" && <p>Loading smart search…</p>}
      <ul>
        {results.map((r) => (
          <li key={r.chunk.id}>
            <a href={r.chunk.url}>{[r.chunk.title, ...r.chunk.headings].join(" › ")}</a>
            <p>{r.snippet}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
```

`useCosineSearch` returns keyword results on every keystroke and switches to the hybrid ranking as soon as the model is ready.
