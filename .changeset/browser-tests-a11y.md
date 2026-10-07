---
"@sweberdev/cosine": minor
"@sweberdev/cosine-react": minor
---

Accessibility fix found by the new browser tests: in `<cosine-search>` the link inside each result is now the option itself (`<a role="option">`) instead of sitting inside an `<li role="option">`. Screen readers no longer meet a link nested in an option, and an axe scan of the open list reports no violations. The `result` part still styles the list item, the markup of `result-title` and `result-snippet` is unchanged. Also new: Playwright tests for keyboard use, ARIA and axe in real Chromium, and benchmarks with fixed limits for index size and search time in CI.
