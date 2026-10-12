---
title: Search insights
description: Find out which questions your docs do not answer, without tracking people.
---

Every search that finds nothing is a page someone wanted and you have not written. `@weber-development/cosine-insights` collects those searches and turns them into a to-do list.

## 1. Record searches in the browser

```ts
import { trackSearches } from "@weber-development/cosine-insights";

trackSearches(document.querySelector("cosine-search")!, { endpoint: "/api/search-insights" });
```

A search counts once typing has paused (1.5 s), not on every keystroke. Opening a result sends the query, the URL and its rank. Options: `settleMs`, `sampleRate` (record only a share of visitors), `send` (use your own analytics instead).

## 2. Receive them on your server

The handler is a plain `Request` → `Response` function:

```ts title="app/api/search-insights/route.ts"
import { createInsightsHandler } from "@weber-development/cosine-insights";
import { fileStore } from "@weber-development/cosine-insights/node";

export const POST = createInsightsHandler({ store: fileStore("data/searches.ndjson") });
```

It accepts same-origin requests only (set `origins` for others), validates every event and adds a timestamp. Implement `InsightsStore` (`append(event)`) to write to a database, KV store or log service instead of a file.

## 3. Read the report

```sh
npx cosine-insights report --log data/searches.ndjson --out insights.html --since 2026-09-01
```

The report lists:

- **Searches without results:** missing pages, or missing words in existing ones.
- **Results nobody opened:** the search found something, but it did not look like the answer.
- **Most searched** queries and **most opened** pages, the click rate and the mean rank of opened results.

`--out insights.md` writes Markdown, e.g. for a monthly issue. `--out insights.csv` (or `--format csv`) writes the query lists as one table for a spreadsheet or your ticket system, with the columns `list` (`no-results`, `no-clicks`, `top`), `query`, `searches`, `clicks` and `results`. From code: `analyze(events)`, `renderMarkdown(report)`, `renderHtml(report)`, `renderCsv(report)`.

## 4. See whether it gets better

```bash
npx cosine-insights trends --log searches.ndjson --out trends.html
```

`trends` compares the last 28 days (`--days <n>` changes the length) with the 28 days before:

- **New gaps:** queries that found nothing in the last period and were not a problem before. These are the pages to write next.
- **Resolved gaps:** queries that found nothing before and now find something or get opened. This is the proof that your fixes work.
- **Rising:** queries searched clearly more often than before.
- **By week:** searches, searches without results and clicks per week, as a chart in the HTML report.

`--out trends.md` writes Markdown for a monthly issue, `--out trends.csv` the weekly series (`week,searches,no_results,clicks`). The log needs timestamps, which the handler adds. From code: `analyzeTrends(events, { days })`, `renderTrendsHtml(trends)`, `renderTrendsMarkdown(trends)`, `renderTrendsCsv(trends)`.

## 5. Find out why a query failed

```bash
npx cosine-insights suggest --log searches.ndjson --index public/cosine --out gaps.md
```

For every query without results, `suggest` checks the index and says which of three cases it is:

- **Probably a typo:** a word is not in your docs, but a similar one is. The report shows the corrected query and the page it finds. Use it to fix a link or add the word as a [synonym](../guides/indexing.md).
- **Closest pages:** the words are known, but no page covers them together. The report lists the pages that come closest.
- **Nothing comes close:** no page covers the topic. This is the list of pages to write.

`--semantic` also looks pages up by meaning, which needs an index with vectors and `@huggingface/transformers`. `--limit`, `--min` and `--since` work as in `report`. From code, use the `suggest` entry, which needs `@sweberdev/cosine`:

```ts
import { suggestFixes, renderSuggestionsMarkdown } from "@weber-development/cosine-insights/suggest";
```

## 6. A report every week

This GitHub Action runs every Monday, reads the log, and opens an issue with the trends and the gaps. Keep the log where your job can reach it, for example in a private storage bucket, and give the job its address as a secret.

```yaml title=".github/workflows/search-report.yml"
name: Search report
on:
  schedule:
    - cron: "0 6 * * 1"
  workflow_dispatch:
permissions:
  contents: read
  issues: write
jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Install
        run: |
          echo "@weber-development:registry=https://npm.pkg.github.com" >> .npmrc
          echo "//npm.pkg.github.com/:_authToken=${{ secrets.COSINE_PRO_TOKEN }}" >> .npmrc
          npm i --no-save @sweberdev/cosine @weber-development/cosine-insights
      - name: Fetch the log
        run: curl -fsSL "${{ secrets.SEARCH_LOG_URL }}" -o searches.ndjson
      - name: Build the report
        run: |
          npx cosine-insights trends --log searches.ndjson --days 7 --out trends.md
          npx cosine-insights suggest --log searches.ndjson --index public/cosine --since "$(date -d '7 days ago' +%F)" --out gaps.md
          cat trends.md gaps.md > report.md
      - name: Open an issue
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh issue create --title "Search report $(date +%F)" --body-file report.md
```

`COSINE_PRO_TOKEN` is the read-only token from the [install guide](overview.md). The workflow needs your built index in `public/cosine`; if you build it in CI instead, add that step before the report. Without a server log, point `SEARCH_LOG_URL` at wherever your handler's store writes.

## 7. One page with everything

```sh
npx cosine-insights dashboard --log data/searches.ndjson --index public/cosine --out dashboard.html
```

The dashboard is a single HTML file with no external requests: overview numbers, the gaps with suggested fixes, weekly trends, the most searched content and CSV downloads for each table. Open it locally or put it behind your login. `--semantic` also uses the embedding model for the fix suggestions.

## Synonym suggestions

People often search for a word your docs never use: "reimbursement" where the page says "refunds". The
search finds nothing, the visitor leaves. `cosine-insights synonyms` turns those searches into synonym
groups you can review and feed back into the index.

```sh
npx cosine-insights synonyms \
  --log data/searches.ndjson \
  --index public/cosine \
  --existing synonyms.json \
  --out synonyms.suggested.json \
  --md proposal.md \
  --semantic
```

### How it decides

1. It takes the queries that found nothing or that nobody clicked.
2. A word of those queries is a candidate when it appears in no section of your index and was searched
   at least `--min-count` times (default 2).
3. With `--semantic`, it takes the top hit of the semantic search for the word. From the title and
   headings of that section, the word or short phrase that is most similar to the candidate becomes the
   other half of the group. Candidates below a similarity of 0.45 are listed as "No fit found".
4. Without `--semantic` no groups are proposed.

A word that is one or two edits from a known word is a typo, not a synonym. Typos are listed in the
proposal in their own table and are never added to a group.

### Files

`--out` receives your existing groups unchanged, followed by the new ones, without duplicates. The format
is an array of arrays, the same as `cosine build --synonyms`:

```json
[
  ["login", "sign-in"],
  ["refunds", "reimbursement"]
]
```

`--md` receives the proposal: every suggested group with how often it was searched, the queries and the
top page, then the typos and the words without a fit. Review it before you merge: a group is only right
when both words mean the same in your docs.

### Weekly pull request

The package contains a ready-made GitHub Actions workflow, `examples/synonyms-pr.yml`. It runs every
Monday, writes `synonyms.json` and opens a pull request on the branch `cosine/synonyms` with the proposal
as its description. Only `synonyms.json` is committed. You merge it, the next build uses the groups.

| Option | Meaning |
|---|---|
| `--log <file>` | The NDJSON log of the insights handler |
| `--index <dir>` | The folder with `cosine-index.json` |
| `--existing <file>` | Your `synonyms.json`; a missing file counts as empty |
| `--out <file>` | Merged groups as JSON (default `synonyms.suggested.json`) |
| `--md <file>` | The proposal as Markdown |
| `--min-count <n>` | Searches a word needs (default 2) |
| `--semantic` | Look for synonyms by meaning; needs vectors in the index and `@huggingface/transformers` |
| `--since <date>` | Only searches from this date |

## Privacy

- Events go to your own server, never to us or a third party.
- No IP address, cookie, user id or header is stored, only query, result count, opened URL, rank and time.
- Queries that look like e-mail addresses, phone or account numbers, IBANs or tokens are dropped in the browser and again on the server.

Mention the search statistics in your privacy notice all the same.
