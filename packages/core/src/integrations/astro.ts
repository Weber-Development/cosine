import { fileURLToPath } from "node:url";
import { indexBuiltSite, type SiteIndexOptions } from "../site";

/**
 * Astro integration (Starlight included): indexes the built site after `astro build`.
 *
 * ```js
 * // astro.config.mjs
 * import cosine from "@sweberdev/cosine/astro";
 * export default defineConfig({ integrations: [cosine()] });
 * ```
 *
 * The index lands in `dist/cosine/`. Point `<cosine-search index="/cosine/cosine-index.json">` at it.
 */
export default function cosineAstro(options: SiteIndexOptions = {}): {
  name: string;
  hooks: { "astro:build:done": (params: { dir: URL }) => Promise<void> };
} {
  return {
    name: "cosine-search",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        await indexBuiltSite(fileURLToPath(dir), options);
      },
    },
  };
}
