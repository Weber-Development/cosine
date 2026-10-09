---
"@sweberdev/cosine": minor
"@sweberdev/cosine-react": minor
---

API freeze candidate. We reviewed the whole public API and froze it with a test that lists every export, `<cosine-search>` attribute and part, and CLI option, so any removal or rename in 1.x fails CI. The new Stability page says what 1.x promises and which parts (custom embedders, model presets, chunking rules) are still experimental, and those exports are now tagged `@experimental`. New guides cover migrating from Pagefind, Orama, MiniSearch and Lunr, setups for Next.js, Astro, VitePress, Docusaurus, SvelteKit, Vue and plain HTML, and troubleshooting, plus reference pages for performance and upgrading. A nightly CI job now runs the real-model test every day. There are no breaking changes: 0.9 is a drop-in upgrade.
