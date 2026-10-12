import { indexBuiltSite, type SiteIndexOptions } from "../site";

/**
 * Docusaurus plugin: indexes the built site after `docusaurus build`.
 *
 * ```js
 * // docusaurus.config.js
 * plugins: [["@sweberdev/cosine/docusaurus", { model: "english" }]]
 * ```
 *
 * The index lands in `build/cosine/`. Point `<cosine-search index="/cosine/cosine-index.json">` at it.
 */
export default function cosineDocusaurus(
  _context: unknown,
  options: SiteIndexOptions = {},
): { name: string; postBuild(props: { outDir: string; baseUrl?: string }): Promise<void> } {
  return {
    name: "cosine-search",
    async postBuild({ outDir, baseUrl }) {
      await indexBuiltSite(outDir, { ...(baseUrl && { baseUrl }), ...options });
    },
  };
}
