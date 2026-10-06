---
"@sweberdev/cosine": minor
---

Search syntax and boosting. Queries accept `"exact phrases"` and `-excluded` words in every mode, also for the semantic ranking. `cosine build --boost /docs/api=1.5 --boost /blog=0.7` stores ranking weights per URL path in the index (`BuildOptions.boost`, `CosineOptions.boost`). New exports: `parseQuery`, `LexicalIndex#constraints`.
