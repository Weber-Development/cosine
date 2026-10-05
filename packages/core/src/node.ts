import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, sep } from "node:path";
import { type BuildOptions, type BuiltIndex, buildIndex } from "./build";
import { htmlToMarkdown } from "./chunk";
import { Cosine, type CosineOptions } from "./search";
import type { IndexManifest, SourceDocument } from "./types";
import { VectorStore } from "./vectors";

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
      docs.push({ id: rel, url, title: title ?? fallbackTitle, content: markdown });
    } else {
      docs.push({ id: rel, url, title: fallbackTitle, content: raw });
    }
  }
  return docs;
}

/** Writes `cosine-index.json` (and the vector file) to `outDir`. Returns the written paths. */
export async function writeIndex(index: BuiltIndex, outDir: string): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const written: string[] = [];
  const manifestPath = join(outDir, "cosine-index.json");
  await writeFile(manifestPath, JSON.stringify(index.manifest));
  written.push(manifestPath);
  if (index.vectors && index.manifest.vectors) {
    const vectorPath = join(outDir, index.manifest.vectors);
    await writeFile(vectorPath, index.vectors);
    written.push(vectorPath);
  }
  return written;
}

/** Reads a directory, builds the index and writes it. */
export async function buildDirectory(
  dir: string,
  outDir: string,
  options: BuildOptions & ReadDocsOptions = {},
): Promise<{ index: BuiltIndex; files: string[] }> {
  const docs = await readDocs(dir, options);
  const index = await buildIndex(docs, options);
  return { index, files: await writeIndex(index, outDir) };
}

/** Loads an index from disk, e.g. to try queries in Node or in tests. */
export async function loadIndexFile(
  path: string,
  options: Omit<CosineOptions, "manifest" | "vectors"> = {},
): Promise<Cosine> {
  const manifest = JSON.parse(await readFile(path, "utf8")) as IndexManifest;
  let vectors: VectorStore | null = null;
  if (manifest.vectors && options.embedder !== false && options.loadModel !== "never") {
    const buf = await readFile(join(dirname(path), manifest.vectors));
    vectors = VectorStore.fromBuffer(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
    );
  }
  return new Cosine({ ...options, manifest, vectors });
}
