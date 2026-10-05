import { type ChunkOptions, chunkMarkdown } from "./chunk";
import { embedderOptions } from "./embedder";
import type { Chunk, Embedder, IndexManifest, SourceDocument } from "./types";
import { VectorStore } from "./vectors";

export interface BuildOptions extends ChunkOptions {
  /** Embedder for the chunks. Without one the index is lexical only. */
  embedder?: Embedder | null;
  /** File name of the vectors. Default `cosine-vectors.bin`. */
  vectorsFile?: string;
  /** Called after each embedding batch, for progress output. */
  onProgress?: (done: number, total: number) => void;
}

export interface BuiltIndex {
  manifest: IndexManifest;
  /** Binary vector file, or `null` for a lexical-only index. */
  vectors: Uint8Array | null;
}

/** The text a chunk is embedded with: page title and headings give the passage its context. */
export function passageText(chunk: Chunk): string {
  return [[chunk.title, ...chunk.headings].join(" > "), chunk.text].join("\n");
}

/** Chunks the documents and embeds them. Works in Node and in the browser. */
export async function buildIndex(
  documents: SourceDocument[],
  options: BuildOptions = {},
): Promise<BuiltIndex> {
  const chunks: Chunk[] = [];
  for (const doc of documents) chunks.push(...chunkMarkdown(doc, options, chunks.length));

  const embedder = options.embedder ?? null;
  let vectors: Uint8Array | null = null;
  let dimensions = 0;
  if (embedder && chunks.length) {
    const texts = chunks.map(passageText);
    const all: Float32Array[] = [];
    const step = 32;
    for (let i = 0; i < texts.length; i += step) {
      all.push(...(await embedder.embed(texts.slice(i, i + step), "passage")));
      options.onProgress?.(Math.min(i + step, texts.length), texts.length);
    }
    const store = VectorStore.fromVectors(all);
    dimensions = store.dimensions;
    vectors = store.toBuffer();
  }

  const manifest: IndexManifest = {
    version: 1,
    model: vectors && embedder ? embedder.model : null,
    dimensions,
    vectors: vectors ? (options.vectorsFile ?? "cosine-vectors.bin") : null,
    chunks,
    createdAt: new Date().toISOString(),
  };
  const modelOptions = embedder && vectors ? embedderOptions(embedder) : undefined;
  if (modelOptions) manifest.modelOptions = modelOptions;
  return { manifest, vectors };
}
