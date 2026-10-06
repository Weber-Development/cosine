---
"@sweberdev/cosine": minor
---

Synonyms and incremental builds. `cosine build --synonyms synonyms.json` stores synonym groups in the index, so `login` also finds `sign in`, even in keyword search before the model has loaded. `cosine build --incremental` reuses the vectors of the existing index and embeds only new and changed sections. New: `BuildOptions.synonyms`, `BuildOptions.previous`, `CosineOptions.synonyms`, `readIndex()` and `VectorStore#vector()`.
