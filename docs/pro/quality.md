---
title: Search quality
description: Write down which page must answer which query and let CI tell you when a change makes search worse.
---

`@weber-development/cosine-quality` checks your search against golden queries: a list of queries with the page that should come up. It reports the hit rate and the mean reciprocal rank (MRR), and it fails when a query that worked before stops working. Keyword search is enough, so the check needs no model and no network and gives the same result every time.

```sh
pnpm add -D @weber-development/cosine-quality
```

## Write the golden file

```json
[
  { "query": "install", "expect": "/docs/getting-started" },
  { "query": "timeout", "expect": ["/docs/configuration", "/docs/network"], "within": 5 },
  { "query": "log in", "expect": "/docs/auth", "within": 1, "mode": "hybrid" }
]
```

| Field | Meaning |
|---|---|
| `query` | What a visitor types. Each query appears once |
| `expect` | A URL path prefix, or an array of them. Any hit counts. `/docs/api` matches `/docs/api/auth`, not `/docs/api-keys` |
| `within` | The expected page must be among the first `within` pages. Default 3 |
| `mode` | `lexical` or `hybrid`. Default `lexical`; with `--semantic` the default is `hybrid` |

Start with 20 to 50 queries: the ones your visitors search most (see `cosine-insights report`) and the ones that were once broken.

## Run the check

```sh
npx cosine-quality check --index public/cosine --golden golden.json
```

The output is a short summary. Add `--out report.md` for a Markdown report with the failing queries and what was found instead.

## Compare against a baseline

Write the current state once and commit it:

```sh
npx cosine-quality check --index public/cosine --golden golden.json --write-baseline
```

From then on, compare every run with it:

```sh
npx cosine-quality check --index public/cosine --golden golden.json \
  --baseline quality-baseline.json --min-hit-rate 0.9
```

The command exits with 1 when

- a query that passed in the baseline fails now,
- the mean rank of the shared queries got worse, or
- the hit rate is below `--min-hit-rate`.

It exits with 2 when a file cannot be read or the golden file is invalid; the message names the entry. After a change you intended, write the baseline again.

## Rank by meaning

`--semantic` loads the embedding model and ranks like the search box does (hybrid). It needs an index with vectors and `@huggingface/transformers`, and it is slower. Queries with `"mode": "lexical"` stay keyword-only.

## Run it in CI

```yaml
name: Search quality
on: pull_request

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
        env:
          COSINE_PRO_TOKEN: ${{ secrets.COSINE_PRO_TOKEN }}
      - run: pnpm build
      - name: Check search quality
        run: |
          set +e
          npx cosine-quality check --index public/cosine --golden golden.json \
            --baseline quality-baseline.json --min-hit-rate 0.9 --out quality-report.md
          code=$?
          cat quality-report.md >> "$GITHUB_STEP_SUMMARY"
          exit $code
```

The report shows on the summary page of the run, and a regression fails the check.

## From code

```ts
import { loadIndexFile } from "@sweberdev/cosine/node";
import {
  compareReports,
  readGolden,
  renderReportMarkdown,
  runGolden,
} from "@weber-development/cosine-quality";

const cosine = await loadIndexFile("public/cosine/cosine-index.json", {
  embedder: false,
  loadModel: "never",
});
const report = await runGolden(cosine, await readGolden("golden.json"));
console.log(report.hitRate, report.mrr, report.failures);
console.log(renderReportMarkdown(report, compareReports(previousReport, report)));
```

`runGolden` returns `{ results, passed, total, hitRate, mrr, failures }`. `compareReports(previous, current)` returns the regressions, and `readGolden(path)` throws with the file and the entry when the file is wrong.
