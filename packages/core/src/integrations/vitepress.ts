import { indexBuiltSite, type SiteIndexOptions } from "../site";

/**
 * VitePress: indexes the built site in the `buildEnd` hook.
 *
 * ```js
 * // .vitepress/config.mjs
 * import { cosineBuildEnd } from "@sweberdev/cosine/vitepress";
 * export default defineConfig({ buildEnd: cosineBuildEnd() });
 * ```
 *
 * The index lands in `.vitepress/dist/cosine/`. Point `<cosine-search index="/cosine/cosine-index.json">` at it.
 */
export function cosineBuildEnd(
  options: SiteIndexOptions = {},
): (siteConfig: { outDir: string; site?: { base?: string } }) => Promise<void> {
  return async (siteConfig) => {
    const base = siteConfig.site?.base;
    await indexBuiltSite(siteConfig.outDir, { ...(base && { baseUrl: base }), ...options });
  };
}
