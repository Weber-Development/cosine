import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, sep } from "node:path";
import { type BuildOptions, type BuiltIndex, buildIndex } from "./build";
import { htmlToMarkdown } from "./chunk";
import {
  loadManifestParts,
  type ShardRef,
  serializeManifest,
  serializeShardRoot,
} from "./manifest";
import { Cosine, type CosineOptions } from "./search";
import type { IndexManifest, SourceDocument } from "./types";
import type { VectorStore } from "./vectors";

export type { BuildOptions, BuiltIndex } from "./build";
export { buildIndex, passageText } from "./build";

export interface ReadDocsOptions {
  /** URL prefix of the pages, e.g. `/docs`. Default `/`. */
  baseUrl?: string;
  /** File extensions to read. Default `.md`, `.mdx`, `.markdown`, `.html`, `.htm`, `.txt`. */
  extensions?: string[];
  /** Paths (relative to the directory, with `/`) to skip. Strings match as prefix, RegExps anywhere. */
  exclude?: Array<string | RegExp>;
}

const DEFAULT_EXTENSIONS = [".md", ".mdx", ".markdown", ".html", ".htm", ".txt"];

/**
 * `guides/cli.md` → `/docs/guides/cli`, `index.md` → `/docs/`, `about/index.html` → `/docs/about/`.
 */
export function fileUrl(path: string, baseUrl = "/"): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  let page = path.replace(/\.(mdx?|markdown|html?|txt)$/i, "");
  if (page === "index") page = "";
  else if (page.endsWith("/index")) page = page.slice(0, -"index".length);
  return base + page;
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out.sort();
}

/** Reads Markdown, MDX, HTML and text files from a directory into documents. */
export async function readDocs(
  dir: string,
  options: ReadDocsOptions = {},
): Promise<SourceDocument[]> {
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  const docs: SourceDocument[] = [];
  for (const file of await walk(dir)) {
    const ext = extname(file).toLowerCase();
    if (!extensions.includes(ext)) continue;
    const rel = relative(dir, file).split(sep).join("/");
    if (options.exclude?.some((p) => (typeof p === "string" ? rel.startsWith(p) : p.test(rel))))
      continue;
    const raw = await readFile(file, "utf8");
    const url = fileUrl(rel, options.baseUrl);
    const fallbackTitle =
      rel
        .replace(/\.[^.]+$/, "")
        .split("/")
        .pop() ?? rel;
    if (ext === ".html" || ext === ".htm") {
      if (/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(raw)) continue;
      const { title, markdown } = htmlToMarkdown(raw);
      docs.push({
        id: rel,
        url,
        title: title ?? fallbackTitle,
        content: markdown,
      });
    } else {
      docs.push({ id: rel, url, title: fallbackTitle, content: raw });
    }
  }
  return docs;
}

export interface WriteIndexOptions {
  /**
   * Split the index into files of about this many sections (whole pages stay together). The
   * browser loads the shards in parallel and unchanged shards stay cached between builds.
   * Default: one file.
   */
  shardSize?: number;
}

/** Writes `cosine-index.json` (and the vector file) to `outDir`. Returns the written paths. */
export async function writeIndex(
  index: BuiltIndex,
  outDir: string,
  options: WriteIndexOptions = {},
): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const written: string[] = [];
  const manifestPath = join(outDir, "cosine-index.json");
  const size = options.shardSize && options.shardSize > 0 ? Math.floor(options.shardSize) : 0;
  const { manifest } = index;
  if (!size || manifest.chunks.length <= size) {
    await writeFile(manifestPath, serializeManifest(manifest));
    written.push(manifestPath);
    if (index.vectors && manifest.vectors) {
      const vectorPath = join(outDir, manifest.vectors);
      await writeFile(vectorPath, index.vectors);
      written.push(vectorPath);
    }
    return written;
  }

  // Group whole pages into shards, so a page is never split across files.
  const groups: Array<{ from: number; to: number }> = [];
  let from = 0;
  const chunks = manifest.chunks;
  for (let i = 1; i <= chunks.length; i++) {
    const pageEnds = i === chunks.length || chunks[i]?.doc !== chunks[i - 1]?.doc;
    if (pageEnds && (i - from >= size || i === chunks.length)) {
      groups.push({ from, to: i });
      from = i;
    }
  }
  const refs: ShardRef[] = [];
  const vectorBase = (manifest.vectors ?? "cosine-vectors.bin").replace(/\.bin$/, "");
  for (const [n, group] of groups.entries()) {
    const file = `cosine-shard-${n}.json`;
    const hasVectors = Boolean(index.store && manifest.vectors);
    // Settings and the build time live in the root, so an unchanged shard is byte-identical.
    const { synonyms: _s, boost: _b, ...base } = manifest;
    const shard = {
      ...base,
      createdAt: "",
      vectors: hasVectors ? `${vectorBase}-${n}.bin` : null,
      chunks: chunks.slice(group.from, group.to),
    };
    await writeFile(join(outDir, file), serializeManifest(shard));
    written.push(join(outDir, file));
    if (hasVectors && shard.vectors && index.store) {
      await writeFile(
        join(outDir, shard.vectors),
        index.store.slice(group.from, group.to).toBuffer(),
      );
      written.push(join(outDir, shard.vectors));
    }
    refs.push({ file, chunks: group.to - group.from });
  }
  await writeFile(manifestPath, serializeShardRoot(manifest, refs));
  written.unshift(manifestPath);
  return written;
}

/** Reads a directory, builds the index and writes it. */
export async function buildDirectory(
  dir: string,
  outDir: string,
  options: BuildOptions & ReadDocsOptions & WriteIndexOptions = {},
): Promise<{ index: BuiltIndex; files: string[] }> {
  const docs = await readDocs(dir, options);
  const index = await buildIndex(docs, options);
  return {
    index,
    files: await writeIndex(
      index,
      outDir,
      options.shardSize ? { shardSize: options.shardSize } : {},
    ),
  };
}

function diskIO(dir: string) {
  return {
    json: async (file: string) => JSON.parse(await readFile(join(dir, file), "utf8")) as unknown,
    binary: async (file: string) => {
      const buf = await readFile(join(dir, file));
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    },
  };
}

/**
 * Reads the index in `dir` (`cosine-index.json` and its vectors) for an incremental build.
 * Returns `null` when there is none or it cannot be read.
 */
export async function readIndex(
  dir: string,
): Promise<{ manifest: IndexManifest; vectors: VectorStore | null } | null> {
  try {
    return await loadManifestParts(diskIO(dir), "cosine-index.json", true);
  } catch {
    return null;
  }
}

/** Loads an index from disk, e.g. to try queries in Node or in tests. */
export async function loadIndexFile(
  path: string,
  options: Omit<CosineOptions, "manifest" | "vectors"> = {},
): Promise<Cosine> {
  const withVectors = options.embedder !== false && options.loadModel !== "never";
  const { manifest, vectors } = await loadManifestParts(
    diskIO(dirname(path)),
    basename(path),
    withVectors,
  );
  return new Cosine({ ...options, manifest, vectors });
}
