import { describe, expect, it } from "vitest";
import { buildIndex } from "../src/build";
import { Cosine } from "../src/search";
import type { Embedder } from "../src/types";

// Fixed limits for index size and search time. They sit a few times above what the code needs
// today, so a slow CI runner does not fail the build, but a change that makes the index or the
// search several times worse does. Raise a limit only on purpose and say why in the commit.
const LIMITS = {
  /** Bytes of the manifest per section without the section text (title, url, headings). */
  manifestBytesPerSection: 400,
  /** int8 vectors of 384 dimensions: one byte per dimension plus a few bytes of header. */
  vectorBytesPerSection: 400,
  /** Median and 95th percentile of one keyword search over the whole site, in milliseconds. */
  lexicalMedianMs: 5,
  lexicalP95Ms: 20,
  /** Building 3000 sections without embeddings, in milliseconds. */
  buildMs: 3000,
};

const WORDS = Array.from(
  { length: 1500 },
  (_, i) => `term${i.toString(36)}${"abcdefghij"[i % 10]}`,
);

function pick(seed: number, n: number): string {
  const out: string[] = [];
  let x = seed * 2654435761;
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    out.push(WORDS[x % WORDS.length] as string);
  }
  return out.join(" ");
}

function docs(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `d${i}`,
    url: `/docs/section${i % 20}/page${i}`,
    title: `Page ${i} ${pick(i, 2)}`,
    content: [1, 2, 3]
      .map((s) => `## Heading ${s} ${pick(i * 7 + s, 2)}\n\n${pick(i * 13 + s, 60)}.`)
      .join("\n\n"),
  }));
}

function sizedEmbedder(dimensions: number): Embedder {
  return {
    model: "bench-model",
    dimensions,
    async embed(texts) {
      return texts.map((t, k) => {
        const v = new Float32Array(dimensions);
        for (let i = 0; i < dimensions; i++) v[i] = Math.sin((t.length + k) * (i + 1));
        return v;
      });
    },
  };
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] as number;
}

describe("benchmarks", () => {
  it("builds a 3000 section index quickly and keeps it small", async () => {
    const started = performance.now();
    const built = await buildIndex(docs(1000));
    const elapsed = performance.now() - started;
    const sections = built.manifest.chunks.length;
    expect(sections).toBeGreaterThanOrEqual(3000);
    const text = built.manifest.chunks.reduce((n, c) => n + c.text.length, 0);
    const bytes = JSON.stringify(built.manifest).length - text;
    console.log(
      `build ${Math.round(elapsed)} ms, overhead ${Math.round(bytes / sections)} B/section`,
    );
    expect(elapsed).toBeLessThan(LIMITS.buildMs);
    expect(bytes / sections).toBeLessThan(LIMITS.manifestBytesPerSection);
  });

  it("stores about one byte per dimension and section", async () => {
    const built = await buildIndex(docs(50), { embedder: sizedEmbedder(384) });
    const sections = built.manifest.chunks.length;
    const perSection = (built.vectors?.byteLength ?? 0) / sections;
    console.log(`vectors ${perSection.toFixed(1)} B/section`);
    expect(perSection).toBeLessThan(LIMITS.vectorBytesPerSection);
    expect(perSection).toBeGreaterThan(300);
  });

  it("answers a keyword search over 3000 sections in a few milliseconds", async () => {
    const { manifest } = await buildIndex(docs(1000));
    const cosine = new Cosine({ manifest });
    const queries = Array.from({ length: 60 }, (_, i) => pick(i + 500, 2));
    for (const q of queries.slice(0, 5)) cosine.searchLexical(q); // warm up
    const times = queries.map((q) => {
      const t = performance.now();
      cosine.searchLexical(q);
      return performance.now() - t;
    });
    times.sort((a, b) => a - b);
    const median = percentile(times, 0.5);
    const p95 = percentile(times, 0.95);
    console.log(`lexical median ${median.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms`);
    expect(median).toBeLessThan(LIMITS.lexicalMedianMs);
    expect(p95).toBeLessThan(LIMITS.lexicalP95Ms);
  });
});
