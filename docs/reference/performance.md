---
title: Performance
description: Index size, build time and search time, measured by the benchmarks that run in CI.
---

The numbers on this page come from `packages/core/test/bench.test.ts`. The test builds a synthetic site of 1000 pages (3000 sections of about 60 words each) and measures the result. It runs on every pull request with fixed limits, so a change that makes the index or the search several times worse fails the build.

## Measured

Measured with `npx vitest run test/bench.test.ts --disableConsoleIntercept` on a Linux virtual machine with 4 cores, which is about what a CI runner offers. One run, so expect some variation between runs and machines.

| What | Measured | Limit in CI |
|---|---|---|
| Keyword search over 3000 sections, median | 1.0 ms | 5 ms |
| Keyword search over 3000 sections, 95th percentile | 1.6 ms | 20 ms |
| Build of 3000 sections without embeddings | 193 ms | 3000 ms |
| Manifest overhead per section (title, url, headings, without the text) | 169 bytes | 400 bytes |
| Vectors per section (384 dimensions, 8 bit) | 388 bytes | 400 bytes |

The limits sit a few times above the measurements on purpose. They catch real regressions, not a slow runner.

## What it means for your site

The index is the text of your pages plus about 170 bytes per section for the manifest and about 390 bytes per section for the vectors of the default model. Both compress well when your host serves gzip or Brotli.

| Site | Sections | Vectors | Manifest overhead |
|---|---|---|---|
| 100 pages | about 400 | about 150 KB | about 70 KB |
| 1000 pages | about 3000 | about 1.1 MB | about 500 KB |

The text of the pages comes on top of that. The table assumes 3 sections per page, as in the benchmark. Real pages differ, so check the count in the `cosine build` output.

## What the benchmark does not measure

- **Embedding time.** `cosine build` with a model takes seconds to minutes depending on the number of sections and the machine. `--incremental` embeds only changed sections.
- **Model download and start.** The English model is about 23 MB (multilingual about 120 MB). It loads once, when the search field gets focus, and comes from the browser cache afterwards. Keyword results do not wait for it.
- **Semantic search time.** After the model is ready, each query is embedded in the browser and compared with all vectors. This depends on the device and is not part of the CI limits.
- **Real network and slow phones.** The numbers above are for desktop-class CPUs.

For the limits of the approach, see [Why Cosine](../introduction.md).
