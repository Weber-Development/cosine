---
title: Stability
description: What the 1.x versions of Cosine promise, what is frozen, what is experimental and how a test enforces it.
---

From 1.0 on, Cosine follows [semantic versioning](https://semver.org). Version 1.0 keeps the surface that 0.9 froze.

## The promise for 1.x

- **Patch releases (1.0.x)** fix bugs. They do not change documented behaviour.
- **Minor releases (1.x.0)** may add exports, options, attributes, parts and events, and optional fields to the index. They do not remove or rename anything in the frozen list below.
- **Major releases (2.0)** are the only place for breaking changes.

An index built with any 1.x version loads in every 1.x version of the browser code. Newer versions may add optional fields that older code ignores, so a feature that needs a new field (like synonyms did) works only after you rebuild the index.

## Frozen

Everything below keeps its name, its signature and its documented behaviour in 1.x.

### Loading and searching

- `loadIndex(url, options?)`, `loadIndexes(urls, options?)` and the class `CosineGroup`.
- The class `Cosine` with `search`, `searchLexical`, `facets`, `warmup`, `status`, `onStatus` and `chunks`.
- The status values `lexical`, `loading-model`, `ready` and `model-failed`.
- `SearchOptions` (`limit`, `mode` with `hybrid`, `lexical` and `semantic`, `groupByPage`, `scope`) and the shape of `SearchResult`.
- The options of `loadIndex`: `loadModel`, `embedder`, `minSimilarity`, `synonyms`, `boost`, `fetch`.
- The query syntax: `"exact phrases"` and `-excluded` words.

### Building

- `buildIndex` from `@sweberdev/cosine`, and `buildDirectory`, `readIndex`, `writeIndex`, `readDocs` and `loadIndexFile` from `@sweberdev/cosine/node`.
- The options of `buildIndex`: `embedder`, `synonyms`, `boost`, `previous`, `maxChars`, `vectorsFile` and `onProgress`, plus `baseUrl` and `exclude` for `buildDirectory`.

### Command line

- The commands `cosine build <docs-dir>` and `cosine search <index-dir> <query>`.
- The options `--out`, `--base-url`, `--model`, `--lexical-only`, `--exclude`, `--max-chars`, `--query-prefix`, `--passage-prefix`, `--synonyms`, `--boost`, `--incremental`, `--mode`, `--limit` and `--help`.

### Search field

- The element `<cosine-search>` and its attributes `index`, `lang`, `placeholder`, `label`, `limit`, `shortcut`, `mode`, `load-model`, `scope` and `facets`.
- The parts `field`, `input`, `shortcut`, `panel`, `facets`, `results`, `result`, `result-title`, `result-snippet` and `status`.
- The events `cosine-results` and `cosine-select`, with their `detail` fields.
- The custom properties `--cosine-accent`, `--cosine-bg`, `--cosine-text`, `--cosine-muted`, `--cosine-border`, `--cosine-radius`, `--cosine-max-height` and `--cosine-z`.
- In `@sweberdev/cosine-react`: `CosineSearch`, `useCosine` and `useCosineSearch`.

### Index format

- `cosine-index.json` with `version: 1`. 1.x reads and writes version 1 only. New fields are always optional, so older code ignores them. A new required field would be a new version, and that needs a major release.
- The vector file next to the manifest, named in `manifest.vectors`.

## Experimental

These parts work and are tested, but they may change in a minor release. They are marked `@experimental` in the type definitions.

- **The `Embedder` interface** for custom models. It may get new optional members. A custom embedder written for 1.0 keeps working.
- **`transformersEmbedder`, `MODELS` and `DEFAULT_MODEL`.** They depend on the transformers.js API. The preset keys `english` and `multilingual` stay.
- **Chunking rules.** How a page is split into sections (heading levels, `--max-chars`, what is dropped from MDX and HTML) can improve in a minor release. Section ids and anchors may change as a result, so rebuild the index when you upgrade.

The helpers that `@sweberdev/cosine` also exports (`chunkMarkdown`, `htmlToMarkdown`, `parseFrontMatter`, `slugify`, `tokenize`, `normalize`, `makeSnippet`, `fuse`, `LexicalIndex`, `VectorStore` and similar) exist so you can build your own UI or pipeline. Their names are frozen too, but their exact output follows the experimental rules above where it depends on chunking or tokenizing.

## Deprecation policy

When something has to go:

1. A minor release marks it as deprecated in the documentation and the type definitions (`@deprecated`) and, where the call is a function, prints one `console.warn` per page load or process that names the replacement.
2. It keeps working for the whole minor series that follows, and for the rest of the 1.x line unless it has a security problem.
3. It is removed in the next major release, and the [upgrade notes](upgrading.md) say what to do.

Nothing is deprecated today.

## How a test enforces it

`packages/core/test/api-surface.test.ts` lists the runtime exports of `@sweberdev/cosine`, `@sweberdev/cosine/node` and `@sweberdev/cosine/element`, the methods of `Cosine` and `CosineGroup`, the attributes and parts of `<cosine-search>` and the options in the CLI help text. The lists are written out literally, and the test runs in CI on every pull request.

If you remove or rename something, the test fails. Adding an export fails the test as well, so a new name is always a conscious decision: add it to the list in the same pull request. Within 1.x, only additions to the lists are allowed.
