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
  /** Groups of words that mean the same, stored in the index, e.g. `[["login", "sign-in"]]`. */
  synonyms?: string[][];
  /** Ranking weights per URL path, stored in the index, e.g. `{ "/docs/api": 1.5, "/blog": 0.7 }`. */
  boost?: Record<string, number>;
  /**
   * The index from the last build. Sections whose text did not change keep their vectors, so
   * only new and changed sections are embedded. Ignored when it was built with another model.
   */
  previous?: { manifest: IndexManifest; vectors: VectorStore | null } | null;
}

export interface BuiltIndex {
  manifest: IndexManifest;
  /** Binary vector file, or `null` for a lexical-only index. */
  vectors: Uint8Array | null;
  /** Sections that kept their vectors from `previous`. */
  reused: number;
  /** Sections that were embedded in this build. */
  embedded: number;
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
  let reused = 0;
  let embedded = 0;
  if (embedder && chunks.length) {
    const texts = chunks.map(passageText);
    const all: Array<Float32Array | undefined> = new Array(texts.length);
    const known = reusableVectors(options.previous, embedder);
    const missing: number[] = [];
    texts.forEach((text, i) => {
      const vector = known.get(text);
      if (vector) all[i] = vector;
      else missing.push(i);
    });
    reused = texts.length - missing.length;
    const step = 32;
    for (let i = 0; i < missing.length; i += step) {
      const batch = missing.slice(i, i + step);
      const out = await embedder.embed(
        batch.map((j) => texts[j] as string),
        "passage",
      );
      batch.forEach((j, k) => {
        all[j] = out[k];
      });
      options.onProgress?.(Math.min(i + step, missing.length), missing.length);
    }
    embedded = missing.length;
    const store = VectorStore.fromVectors(all as Float32Array[]);
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
  const synonyms = options.synonyms?.filter((group) => group.length > 1);
  if (synonyms?.length) manifest.synonyms = synonyms;
  if (options.boost && Object.keys(options.boost).length) manifest.boost = options.boost;
  return { manifest, vectors, reused, embedded };
}

/** Vectors of the previous build by passage text, when they come from the same model setup. */
function reusableVectors(
  previous: BuildOptions["previous"],
  embedder: Embedder,
): Map<string, Float32Array> {
  const out = new Map<string, Float32Array>();
  if (!previous?.vectors || previous.manifest.model !== embedder.model) return out;
  const before = previous.manifest.modelOptions ?? {};
  const now = embedderOptions(embedder) ?? {};
  if (
    before.passagePrefix !== now.passagePrefix ||
    (before.dtype ?? "q8") !== (now.dtype ?? "q8") ||
    previous.vectors.count !== previous.manifest.chunks.length
  ) {
    return out;
  }
  previous.manifest.chunks.forEach((chunk, i) => {
    out.set(passageText(chunk), (previous.vectors as VectorStore).vector(i));
  });
  return out;
}
