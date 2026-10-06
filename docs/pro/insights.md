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

## Privacy

- Events go to your own server, never to us or a third party.
- No IP address, cookie, user id or header is stored, only query, result count, opened URL, rank and time.
- Queries that look like e-mail addresses, phone or account numbers, IBANs or tokens are dropped in the browser and again on the server.

Mention the search statistics in your privacy notice all the same.
