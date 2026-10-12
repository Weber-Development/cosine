import { join } from "node:path";
import type { BuildOptions } from "./build";
import { transformersEmbedder } from "./embedder";
import { buildDirectory, type ReadDocsOptions, readIndex, type WriteIndexOptions } from "./node";

export interface SiteIndexOptions extends ReadDocsOptions, WriteIndexOptions {
  /** Folder for the index inside the built site. Default `cosine`. */
  out?: string;
  /** Model preset (`english`, `multilingual`) or Hugging Face model id; `false` for keyword search only. Default `english`. */
  model?: string | false;
  synonyms?: string[][];
  boost?: Record<string, number>;
  vectorBits?: 4 | 8;
  /** Reuse the vectors of the previous index in the output folder. Default true. */
  incremental?: boolean;
  /** Where messages go. Default `console.log`. */
  log?: (line: string) => void;
}

/**
 * Indexes a built site (a folder of HTML files) and writes the index into it. The base of the
 * integrations for Astro, Docusaurus and VitePress; also usable from your own build script.
 */
export async function indexBuiltSite(
  siteDir: string,
  options: SiteIndexOptions = {},
): Promise<void> {
  const log = options.log ?? console.log;
  const out = join(siteDir, options.out ?? "cosine");
  const embedder =
    options.model === false ? null : transformersEmbedder({ model: options.model ?? "english" });
  const previous = embedder && options.incremental !== false ? await readIndex(out) : null;
  const build: BuildOptions & ReadDocsOptions & WriteIndexOptions = {
    embedder,
    baseUrl: options.baseUrl ?? "/",
    exclude: [...(options.exclude ?? []), options.out ?? "cosine"],
    ...(options.extensions && { extensions: options.extensions }),
    ...(options.synonyms && { synonyms: options.synonyms }),
    ...(options.boost && { boost: options.boost }),
    ...(options.vectorBits && { vectorBits: options.vectorBits }),
    ...(options.shardSize && { shardSize: options.shardSize }),
    ...(previous && { previous }),
  };
  const { index } = await buildDirectory(siteDir, out, build);
  log(
    `cosine: indexed ${new Set(index.manifest.chunks.map((c) => c.doc)).size} pages as ${index.manifest.chunks.length} sections in ${out}`,
  );
}
