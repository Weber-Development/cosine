const MAGIC = 0x31534f43; // "COS1", little-endian: int8 vectors
const MAGIC_4BIT = 0x32534f43; // "COS2": 4-bit vectors, two values per byte

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
    /** Bits per value in the file: 8 (default) or 4. */
    readonly bits: 8 | 4 = 8,
  ) {}

  /** `bits: 4` stores half the bytes at a small cost in ranking quality. Default 8. */
  static fromVectors(vectors: Float32Array[], options: { bits?: 8 | 4 } = {}): VectorStore {
    const bits = options.bits === 4 ? 4 : 8;
    const levels = bits === 4 ? 7 : 127;
    const dimensions = vectors[0]?.length ?? 0;
    const scales = new Float32Array(vectors.length);
    const data = new Int8Array(vectors.length * dimensions);
    vectors.forEach((raw, i) => {
      if (raw.length !== dimensions) throw new Error("cosine: all vectors need the same length");
      const v = normalizeVector(raw);
      let max = 0;
      for (const x of v) max = Math.max(max, Math.abs(x));
      const scale = max / levels || 1;
      scales[i] = scale;
      for (let j = 0; j < dimensions; j++)
        data[i * dimensions + j] = Math.round((v[j] as number) / scale);
    });
    return new VectorStore(vectors.length, dimensions, scales, data, bits);
  }

  static fromBuffer(buffer: ArrayBuffer): VectorStore {
    const view = new DataView(buffer);
    const magic = buffer.byteLength >= 12 ? view.getUint32(0, true) : 0;
    if (magic !== MAGIC && magic !== MAGIC_4BIT) {
      throw new Error("cosine: not a Cosine vector file");
    }
    const bits = magic === MAGIC_4BIT ? 4 : 8;
    const count = view.getUint32(4, true);
    const dimensions = view.getUint32(8, true);
    const size = bits === 4 ? Math.ceil((count * dimensions) / 2) : count * dimensions;
    if (buffer.byteLength < 12 + count * 4 + size)
      throw new Error("cosine: vector file is truncated");
    const scales = new Float32Array(buffer.slice(12, 12 + count * 4));
    if (bits === 8) {
      return new VectorStore(
        count,
        dimensions,
        scales,
        new Int8Array(buffer, 12 + count * 4, size),
      );
    }
    const packed = new Uint8Array(buffer, 12 + count * 4, size);
    const data = new Int8Array(count * dimensions);
    for (let i = 0; i < data.length; i++) {
      const byte = packed[i >> 1] as number;
      const nibble = i % 2 === 0 ? byte & 0x0f : byte >> 4;
      data[i] = nibble > 7 ? nibble - 16 : nibble;
    }
    return new VectorStore(count, dimensions, scales, data, 4);
  }

  toBuffer(): Uint8Array {
    const size = this.bits === 4 ? Math.ceil(this.data.length / 2) : this.data.length;
    const out = new Uint8Array(12 + this.count * 4 + size);
    const view = new DataView(out.buffer);
    view.setUint32(0, this.bits === 4 ? MAGIC_4BIT : MAGIC, true);
    view.setUint32(4, this.count, true);
    view.setUint32(8, this.dimensions, true);
    out.set(new Uint8Array(this.scales.buffer, this.scales.byteOffset, this.scales.byteLength), 12);
    const at = 12 + this.count * 4;
    if (this.bits === 8) {
      out.set(new Uint8Array(this.data.buffer, this.data.byteOffset, this.data.byteLength), at);
    } else {
      for (let i = 0; i < this.data.length; i++) {
        const nibble = (this.data[i] as number) & 0x0f;
        out[at + (i >> 1)] = (out[at + (i >> 1)] as number) | (i % 2 === 0 ? nibble : nibble << 4);
      }
    }
    return out;
  }

  /** The vectors `from` (included) to `to` (excluded) as a store of their own, e.g. for one shard. */
  slice(from: number, to: number): VectorStore {
    const d = this.dimensions;
    return new VectorStore(
      to - from,
      d,
      this.scales.slice(from, to),
      this.data.slice(from * d, to * d),
      this.bits,
    );
  }

  /** Joins stores of the same model into one, in order. */
  static concat(stores: VectorStore[]): VectorStore {
    const first = stores[0];
    if (!first) return new VectorStore(0, 0, new Float32Array(0), new Int8Array(0));
    if (stores.some((s) => s.dimensions !== first.dimensions || s.bits !== first.bits)) {
      throw new Error("cosine: shards were built with different models");
    }
    const count = stores.reduce((n, s) => n + s.count, 0);
    const scales = new Float32Array(count);
    const data = new Int8Array(count * first.dimensions);
    let at = 0;
    for (const s of stores) {
      scales.set(s.scales, at);
      data.set(s.data, at * first.dimensions);
      at += s.count;
    }
    return new VectorStore(count, first.dimensions, scales, data, first.bits);
  }

  /** The stored vector at `index`, normalized and restored from int8. */
  vector(index: number): Float32Array {
    if (index < 0 || index >= this.count) throw new RangeError(`cosine: no vector ${index}`);
    const d = this.dimensions;
    const scale = this.scales[index] as number;
    const out = new Float32Array(d);
    for (let j = 0; j < d; j++) out[j] = (this.data[index * d + j] as number) * scale;
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
