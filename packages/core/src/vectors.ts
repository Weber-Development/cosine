const MAGIC = 0x31534f43; // "COS1", little-endian

/** Scales a vector to length 1, so cosine similarity becomes a dot product. */
export function normalizeVector(v: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += (v[i] as number) ** 2;
  const len = Math.sqrt(sum) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = (v[i] as number) / len;
  return out;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] as number;
    const y = b[i] as number;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/**
 * Normalized vectors stored as int8 with one scale per vector: a quarter of the size of float32,
 * with a ranking that is practically the same for search.
 */
export class VectorStore {
  constructor(
    readonly count: number,
    readonly dimensions: number,
    private readonly scales: Float32Array,
    private readonly data: Int8Array,
  ) {}

  static fromVectors(vectors: Float32Array[]): VectorStore {
    const dimensions = vectors[0]?.length ?? 0;
    const scales = new Float32Array(vectors.length);
    const data = new Int8Array(vectors.length * dimensions);
    vectors.forEach((raw, i) => {
      if (raw.length !== dimensions) throw new Error("cosine: all vectors need the same length");
      const v = normalizeVector(raw);
      let max = 0;
      for (const x of v) max = Math.max(max, Math.abs(x));
      const scale = max / 127 || 1;
      scales[i] = scale;
      for (let j = 0; j < dimensions; j++)
        data[i * dimensions + j] = Math.round((v[j] as number) / scale);
    });
    return new VectorStore(vectors.length, dimensions, scales, data);
  }

  static fromBuffer(buffer: ArrayBuffer): VectorStore {
    const view = new DataView(buffer);
    if (buffer.byteLength < 12 || view.getUint32(0, true) !== MAGIC) {
      throw new Error("cosine: not a Cosine vector file");
    }
    const count = view.getUint32(4, true);
    const dimensions = view.getUint32(8, true);
    const expected = 12 + count * 4 + count * dimensions;
    if (buffer.byteLength < expected) throw new Error("cosine: vector file is truncated");
    const scales = new Float32Array(buffer.slice(12, 12 + count * 4));
    const data = new Int8Array(buffer, 12 + count * 4, count * dimensions);
    return new VectorStore(count, dimensions, scales, data);
  }

  toBuffer(): Uint8Array {
    const out = new Uint8Array(12 + this.count * 4 + this.data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, MAGIC, true);
    view.setUint32(4, this.count, true);
    view.setUint32(8, this.dimensions, true);
    out.set(new Uint8Array(this.scales.buffer, this.scales.byteOffset, this.scales.byteLength), 12);
    out.set(
      new Uint8Array(this.data.buffer, this.data.byteOffset, this.data.byteLength),
      12 + this.count * 4,
    );
    return out;
  }

  /** Cosine similarity of `query` to every stored vector, best first. */
  search(query: Float32Array, limit = 20): Array<{ id: number; score: number }> {
    if (query.length !== this.dimensions) {
      throw new Error(
        `cosine: query has ${query.length} dimensions, the index ${this.dimensions}. Use the same model for both.`,
      );
    }
    const q = normalizeVector(query);
    const hits: Array<{ id: number; score: number }> = [];
    const d = this.dimensions;
    for (let i = 0; i < this.count; i++) {
      let dot = 0;
      const offset = i * d;
      for (let j = 0; j < d; j++) dot += (q[j] as number) * (this.data[offset + j] as number);
      hits.push({ id: i, score: dot * (this.scales[i] as number) });
    }
    return hits.sort((a, b) => b.score - a.score || a.id - b.id).slice(0, limit);
  }
}
