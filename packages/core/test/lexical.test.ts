import { describe, expect, it } from "vitest";
import { editDistance, LexicalIndex } from "../src/lexical";
import { fuse, scopeFilter, siblingUrl } from "../src/search";
import { makeSnippet } from "../src/snippet";
import { normalize, tokenize } from "../src/tokenize";
import { cosineSimilarity, VectorStore } from "../src/vectors";

describe("tokenize", () => {
  it("folds accents and ß, drops stop words, splits identifiers", () => {
    expect(normalize("Größe Café")).toBe("grosse cafe");
    expect(tokenize("How do I use the use-search hook?")).toEqual([
      "do",
      "use",
      "use-search",
      "use",
      "search",
      "hook",
    ]);
  });
});

describe("LexicalIndex", () => {
  const index = new LexicalIndex([
    "install the package",
    "uninstall everything",
    "billing and invoices",
  ]);

  it("ranks by BM25", () => {
    expect(index.search("invoices")[0]?.id).toBe(2);
  });

  it("matches the last word as a prefix while typing", () => {
    expect(index.search("instal").map((h) => h.id)).toEqual([0]);
    // A finished word is not a prefix, but still a close spelling of "install".
    expect(index.search("instal ").map((h) => h.id)).toEqual([0]);
  });

  it("tolerates typos in words that are not in the index", () => {
    expect(index.search("invoces")[0]?.id).toBe(2);
    expect(index.search("biling")[0]?.id).toBe(2);
    expect(index.search("pakcage")[0]?.id).toBe(0);
    // Words shorter than four letters are never guessed.
    expect(index.search("bil ")).toEqual([]);
  });
});

describe("editDistance", () => {
  it("counts edits and swapped neighbours", () => {
    expect(editDistance("invoice", "invoice")).toBe(0);
    expect(editDistance("invoce", "invoice")).toBe(1);
    expect(editDistance("pakcage", "package")).toBe(1);
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("kitten", "sitting", 1)).toBe(2);
  });
});

describe("scopeFilter", () => {
  it("matches whole path segments", () => {
    const inApi = scopeFilter("/docs/api/");
    expect(inApi("/docs/api")).toBe(true);
    expect(inApi("/docs/api/auth#tokens")).toBe(true);
    expect(inApi("https://example.com/docs/api/auth")).toBe(true);
    expect(inApi("/docs/apis")).toBe(false);
    expect(inApi("/docs/guides/api")).toBe(false);
    expect(scopeFilter(undefined)("/anything")).toBe(true);
    expect(scopeFilter(["/blog", "/docs/api"])("/blog/post")).toBe(true);
  });
});

describe("snippet", () => {
  it("marks query words and centres on them", () => {
    const text = `${"filler ".repeat(60)}the invoice arrives monthly ${"tail ".repeat(60)}`;
    const { snippet, highlights } = makeSnippet(text, "Invoice", 80);
    expect(snippet.startsWith("… ")).toBe(true);
    const [s, e] = highlights[0] as [number, number];
    expect(snippet.slice(s, e)).toBe("invoice");
  });
});

describe("VectorStore", () => {
  it("round-trips through the binary format and keeps the ranking", () => {
    const vectors = [
      new Float32Array([1, 0, 0]),
      new Float32Array([0.7, 0.7, 0]),
      new Float32Array([0, 0, 1]),
    ];
    const store = VectorStore.fromVectors(vectors);
    const bytes = store.toBuffer();
    const copy = VectorStore.fromBuffer(bytes.buffer.slice(0) as ArrayBuffer);
    const query = new Float32Array([0.9, 0.3, 0]);
    const hits = copy.search(query);
    expect(hits.map((h) => h.id)).toEqual([0, 1, 2]);
    for (const hit of hits) {
      expect(hit.score).toBeCloseTo(cosineSimilarity(query, vectors[hit.id] as Float32Array), 1);
    }
  });

  it("rejects foreign files and wrong dimensions", () => {
    expect(() => VectorStore.fromBuffer(new ArrayBuffer(16))).toThrow(/not a Cosine/);
    const store = VectorStore.fromVectors([new Float32Array([1, 0])]);
    expect(() => store.search(new Float32Array([1, 0, 0]))).toThrow(/same model/);
  });
});

describe("fuse / siblingUrl", () => {
  it("rewards results found by both rankings", () => {
    const fused = fuse([{ id: 1 }, { id: 2 }], [{ id: 3 }, { id: 2 }]);
    expect(fused[0]).toMatchObject({ id: 2, matchedBy: ["lexical", "semantic"] });
  });

  it("resolves the vector file next to the manifest", () => {
    expect(siblingUrl("/cosine/cosine-index.json?v=2", "v.bin")).toBe("/cosine/v.bin");
    expect(siblingUrl("https://x.ch/a/i.json", "v.bin")).toBe("https://x.ch/a/v.bin");
  });
});
