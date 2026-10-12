import type { Chunk, IndexManifest } from "./types";
import { VectorStore } from "./vectors";

/** Reference to one shard of a sharded index, as listed in the root `cosine-index.json`. */
export interface ShardRef {
  /** File name of the shard's manifest next to the root manifest. */
  file: string;
  /** Number of sections in the shard. */
  chunks: number;
}

/** What `cosine-index.json` holds on disk: a compact index (v2), a v1 index, or a list of shards. */
export interface StoredManifest extends Omit<IndexManifest, "chunks" | "version"> {
  version: 1 | 2;
  chunks?: unknown[];
  docs?: Array<{ id: string; url: string; title: string }>;
  shards?: ShardRef[];
}

let warnedV1 = false;

/**
 * Compact on-disk form of a manifest (format 2): page id, URL and title are stored once per page
 * and every section is an array `[page, anchor, headings, text]`.
 */
export function serializeManifest(manifest: IndexManifest): string {
  const docs: Array<{ id: string; url: string; title: string }> = [];
  const position = new Map<string, number>();
  const chunks = manifest.chunks.map((chunk) => {
    const hash = chunk.url.indexOf("#");
    const pageUrl = hash === -1 ? chunk.url : chunk.url.slice(0, hash);
    const anchor = hash === -1 ? "" : chunk.url.slice(hash);
    const key = `${chunk.doc}\0${pageUrl}\0${chunk.title}`;
    let at = position.get(key);
    if (at === undefined) {
      at = docs.length;
      position.set(key, at);
      docs.push({ id: chunk.doc, url: pageUrl, title: chunk.title });
    }
    return [at, anchor, chunk.headings, chunk.text];
  });
  const { chunks: _chunks, ...rest } = manifest;
  return JSON.stringify({ ...rest, version: 2, docs, chunks });
}

/** Serializes the root of a sharded index: everything but the sections, plus the shard list. */
export function serializeShardRoot(manifest: IndexManifest, shards: ShardRef[]): string {
  const { chunks: _chunks, vectors: _vectors, ...rest } = manifest;
  return JSON.stringify({ ...rest, version: 2, vectors: null, shards });
}

function expandChunks(stored: StoredManifest): Chunk[] {
  const list = stored.chunks ?? [];
  const docs = stored.docs ?? [];
  return list.map((entry, id) => {
    if (!Array.isArray(entry)) return { ...(entry as Chunk), id };
    const [d, anchor, headings, text] = entry as [number, string, string[], string];
    const doc = docs[d];
    if (!doc) throw new Error(`cosine: the index is damaged (section ${id} has no page)`);
    return { id, doc: doc.id, url: doc.url + anchor, title: doc.title, headings, text };
  });
}

/** True for the root manifest of a sharded index. */
export function isShardRoot(stored: StoredManifest): boolean {
  return Array.isArray(stored.shards);
}

/**
 * Turns the JSON of an index file into a manifest with all sections. Reads format 2 and, with a
 * one-time console warning, format 1. A sharded root has no sections: use `loadManifestParts`.
 */
export function parseManifest(value: unknown): IndexManifest {
  const stored = value as StoredManifest;
  if (!stored || typeof stored !== "object" || !Array.isArray(stored.chunks ?? stored.shards)) {
    throw new Error("cosine: not a Cosine index file");
  }
  if (stored.version === 1) {
    if (!warnedV1 && typeof console !== "undefined") {
      warnedV1 = true;
      console.warn(
        "cosine: this index uses format 1, which Cosine 2 still reads but will drop in a later major version. Rebuild it with `cosine build`.",
      );
    }
  } else if (stored.version !== 2) {
    throw new Error(`cosine: unsupported index version ${String(stored.version)}`);
  }
  const { docs: _docs, shards: _shards, chunks: _chunks, ...rest } = stored;
  return { ...rest, version: stored.version, chunks: expandChunks(stored) } as IndexManifest;
}

/** Reads one file next to the root manifest. */
export interface IndexIO {
  json(file: string): Promise<unknown>;
  binary(file: string): Promise<ArrayBuffer>;
}

/**
 * Loads a manifest and, when `withVectors` is set, its vectors. A sharded index is read in
 * parallel and joined into one, so searching it ranks exactly like the same index in one file.
 */
export async function loadManifestParts(
  io: IndexIO,
  rootFile: string,
  withVectors: boolean,
): Promise<{ manifest: IndexManifest; vectors: VectorStore | null }> {
  const root = (await io.json(rootFile)) as StoredManifest;
  if (!isShardRoot(root)) return loadOne(io, root, withVectors);
  const shards = root.shards as ShardRef[];
  const parts = await Promise.all(
    shards.map(async (shard) =>
      loadOne(io, (await io.json(shard.file)) as StoredManifest, withVectors),
    ),
  );
  const first = parts[0];
  if (!first) throw new Error("cosine: the index lists no shards");
  const chunks: Chunk[] = [];
  for (const part of parts) {
    for (const chunk of part.manifest.chunks) chunks.push({ ...chunk, id: chunks.length });
  }
  const { docs: _docs, shards: _shards, chunks: _chunks, ...rest } = root;
  const vectorStores = parts.map((p) => p.vectors);
  const vectors =
    withVectors && vectorStores.every((v): v is VectorStore => v !== null)
      ? VectorStore.concat(vectorStores)
      : null;
  return {
    manifest: {
      ...first.manifest,
      ...rest,
      version: 2,
      model: first.manifest.model,
      dimensions: first.manifest.dimensions,
      vectors: first.manifest.vectors,
      chunks,
    } as IndexManifest,
    vectors,
  };
}

async function loadOne(io: IndexIO, stored: StoredManifest, withVectors: boolean) {
  const manifest = parseManifest(stored);
  const vectors =
    withVectors && manifest.vectors
      ? VectorStore.fromBuffer(await io.binary(manifest.vectors))
      : null;
  return { manifest, vectors };
}
