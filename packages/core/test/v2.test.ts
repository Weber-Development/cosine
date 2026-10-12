import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildIndex } from "../src/build";
import { parseManifest, serializeManifest } from "../src/manifest";
import { loadIndexFile, writeIndex } from "../src/node";
import { loadIndex } from "../src/search";
import { makeSnippet } from "../src/snippet";
import { tokenize, wordSpans } from "../src/tokenize";
import { VectorStore } from "../src/vectors";
import { toyEmbedder } from "./helpers";

const docs = Array.from({ length: 12 }, (_, i) => ({
  id: `page-${i}.md`,
  url: `/docs/page-${i}`,
  title: `Page ${i}`,
  content: `# Page ${i}\n\nHow to install thing ${i}.\n\n## Remove it\n\nDelete the folder number ${i} to uninstall.\n`,
}));

describe("index format 2", () => {
  it("stores pages once and reads back the same sections", async () => {
    const { manifest } = await buildIndex(docs);
    expect(manifest.version).toBe(2);
    const json = serializeManifest(manifest);
    const stored = JSON.parse(json);
    expect(stored.docs).toHaveLength(12);
    expect(Array.isArray(stored.chunks[0])).toBe(true);
    expect(parseManifest(stored).chunks).toEqual(manifest.chunks);
    expect(json.length).toBeLessThan(JSON.stringify(manifest).length);
  });

  it("reads an expanded manifest and a format 1 index, warning once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const v1 = {
      version: 1,
      model: null,
      dimensions: 0,
      vectors: null,
      createdAt: "",
      chunks: [{ id: 0, doc: "a.md", url: "/a#x", title: "A", headings: ["X"], text: "hello" }],
    };
    expect(parseManifest(v1).chunks[0]?.url).toBe("/a#x");
    parseManifest(v1);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
    expect(() => parseManifest({ version: 3, chunks: [] })).toThrow(/unsupported/);
  });

  it("splits into shards that rank exactly like one file", async () => {
    const embedder = toyEmbedder();
    const built = await buildIndex(docs, { embedder });
    const one = await mkdtemp(join(tmpdir(), "cos-one-"));
    const many = await mkdtemp(join(tmpdir(), "cos-many-"));
    await writeIndex(built, one);
    const files = await writeIndex(built, many, { shardSize: 5 });
    expect(
      (await readdir(many)).filter((f) => f.startsWith("cosine-shard-") && f.endsWith(".json"))
        .length,
    ).toBeGreaterThan(1);
    expect(files[0]).toBe(join(many, "cosine-index.json"));
    const root = JSON.parse(await readFile(join(many, "cosine-index.json"), "utf8"));
    expect(root.shards.reduce((n: number, s: { chunks: number }) => n + s.chunks, 0)).toBe(
      built.manifest.chunks.length,
    );

    const a = await loadIndexFile(join(one, "cosine-index.json"), { embedder });
    const b = await loadIndexFile(join(many, "cosine-index.json"), { embedder });
    await Promise.all([a.warmup(), b.warmup()]);
    for (const q of ["uninstall folder", "install thing 7", "delete"]) {
      const ra = (await a.search(q)).map((r) => [r.chunk.url, r.score]);
      const rb = (await b.search(q)).map((r) => [r.chunk.url, r.score]);
      expect(rb).toEqual(ra);
    }
  });

  it("loads a sharded index over fetch", async () => {
    const built = await buildIndex(docs);
    const dir = await mkdtemp(join(tmpdir(), "cos-fetch-"));
    await writeIndex(built, dir, { shardSize: 4 });
    const seen: string[] = [];
    const fake = (async (url: string) => {
      seen.push(url);
      const file = url.slice(url.lastIndexOf("/") + 1);
      const body = await readFile(join(dir, file));
      return new Response(body, { status: 200 });
    }) as unknown as typeof fetch;
    const cosine = await loadIndex("https://x.test/a/cosine-index.json", { fetch: fake });
    expect(cosine.chunks).toHaveLength(built.manifest.chunks.length);
    expect(cosine.searchLexical("uninstall")[0]).toBeDefined();
    expect(seen.length).toBeGreaterThan(2);
  });

  it("rejects shards from different models", async () => {
    const a = VectorStore.fromVectors([new Float32Array([1, 0])]);
    const b = VectorStore.fromVectors([new Float32Array([1, 0, 0])]);
    expect(() => VectorStore.concat([a, b])).toThrow(/different models/);
  });
});

describe("4-bit vectors", () => {
  it("halves the file and keeps the ranking", () => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32 - 0.5;
    };
    const vectors = Array.from({ length: 200 }, () => Float32Array.from({ length: 64 }, rnd));
    const q = Float32Array.from({ length: 64 }, rnd);
    const eight = VectorStore.fromVectors(vectors);
    const four = VectorStore.fromVectors(vectors, { bits: 4 });
    expect(four.toBuffer().byteLength).toBeLessThan(eight.toBuffer().byteLength * 0.6);
    const back = VectorStore.fromBuffer(four.toBuffer().buffer as ArrayBuffer);
    expect(back.bits).toBe(4);
    expect(back.search(q, 10)).toEqual(four.search(q, 10));
    const top = new Set(eight.search(q, 10).map((h) => h.id));
    const overlap = four.search(q, 10).filter((h) => top.has(h.id)).length;
    expect(overlap).toBeGreaterThanOrEqual(7);
  });

  it("is used by the build", async () => {
    const built = await buildIndex(docs, { embedder: toyEmbedder(), vectorBits: 4 });
    expect(VectorStore.fromBuffer((built.vectors as Uint8Array).slice().buffer).bits).toBe(4);
  });
});

describe("languages without spaces", () => {
  it("splits Japanese, Chinese and Thai into words", () => {
    expect(tokenize("東京タワーに行く").length).toBeGreaterThan(1);
    expect(tokenize("我喜欢搜索文档").length).toBeGreaterThan(1);
    expect(tokenize("ค้นหาเอกสาร").length).toBeGreaterThan(0);
    expect(tokenize("Installation guide")).toEqual(["installation", "guide"]);
  });

  it("keeps kana distinct and highlights found words", () => {
    expect(tokenize("が")).not.toEqual(tokenize("か"));
    const { snippet, highlights } = makeSnippet("東京タワーは東京にあります。", "東京");
    expect(highlights.length).toBeGreaterThan(0);
    for (const [s, e] of highlights) expect(snippet.slice(s, e)).toBe("東京");
    expect(wordSpans("a b").map((w) => w.word)).toEqual(["a", "b"]);
  });
});
