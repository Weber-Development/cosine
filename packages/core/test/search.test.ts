import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildIndex } from "../src/build";
import { parseSynonyms, run } from "../src/cli";
import { buildDirectory, fileUrl, loadIndexFile, readDocs, readIndex } from "../src/node";
import { Cosine, loadIndex } from "../src/search";
import { cosineSimilarity, VectorStore } from "../src/vectors";
import { toyEmbedder } from "./helpers";

const DOCS = join(import.meta.dirname, "fixtures/docs");

async function engine(options: Partial<ConstructorParameters<typeof Cosine>[0]> = {}) {
  const docs = await readDocs(DOCS, { baseUrl: "/docs" });
  const embedder = toyEmbedder();
  const built = await buildIndex(docs, { embedder });
  const vectors = VectorStore.fromBuffer(
    (built.vectors as Uint8Array).slice().buffer as ArrayBuffer,
  );
  return {
    cosine: new Cosine({
      manifest: built.manifest,
      vectors,
      embedder,
      ...options,
    }),
    embedder,
    built,
  };
}

describe("readDocs", () => {
  it("reads Markdown and HTML with clean URLs", async () => {
    const docs = await readDocs(DOCS, { baseUrl: "/docs" });
    expect(docs.map((d) => [d.id, d.url, d.title])).toEqual([
      ["guides/billing.md", "/docs/guides/billing", "billing"],
      ["guides/team.html", "/docs/guides/team", "Team members | Acme"],
      ["index.md", "/docs/", "index"],
    ]);
    expect(docs[1]?.content).not.toContain("Navigation text");
  });

  it("maps file paths to URLs", () => {
    expect(fileUrl("guides/cli.md", "/docs")).toBe("/docs/guides/cli");
    expect(fileUrl("about/index.html")).toBe("/about/");
  });
});

describe("Cosine", () => {
  it("answers lexically before the model is loaded and does not wait for it", async () => {
    const { cosine, embedder } = await engine();
    const calls = embedder.calls;
    expect(cosine.status).toBe("lexical");
    const results = await cosine.search("invoices");
    expect(results[0]?.chunk.url).toBe("/docs/guides/billing#invoices");
    expect(results[0]?.matchedBy).toEqual(["lexical"]);
    // The search started loading the model in the background.
    expect(["loading-model", "ready"]).toContain(cosine.status);
    await cosine.warmup();
    expect(cosine.status).toBe("ready");
    expect(embedder.calls).toBeGreaterThan(calls);
  });

  it("searches only the given scope", async () => {
    const { cosine } = await engine();
    const all = cosine.searchLexical("team invoices", { limit: 20 });
    expect(all.some((r) => r.chunk.url.startsWith("/docs/guides/"))).toBe(true);
    const billing = cosine.searchLexical("team invoices", {
      scope: "/docs/guides/billing",
    });
    expect(billing.length).toBeGreaterThan(0);
    expect(billing.every((r) => r.chunk.url.startsWith("/docs/guides/billing"))).toBe(true);
    expect(cosine.searchLexical("invoices", { scope: "/docs/nowhere" })).toEqual([]);
    await cosine.warmup();
    const hybrid = await cosine.search("coworker rights", {
      scope: ["/docs/"],
    });
    expect(hybrid.every((r) => r.chunk.url.startsWith("/docs/"))).toBe(true);
  });

  it("finds pages by meaning once the model is ready", async () => {
    const { cosine } = await engine();
    expect(cosine.searchLexical("erase app")).toEqual([]);
    await cosine.warmup();
    const results = await cosine.search("erase app");
    expect(results[0]?.chunk.url).toBe("/docs/#uninstall");
    expect(results[0]?.matchedBy).toEqual(["semantic"]);

    const team = await cosine.search("coworker rights", { groupByPage: true });
    expect(team[0]?.chunk.title).toBe("Team members");
    expect(team[0]?.chunk.url).toBe("/docs/guides/team#roles");
  });

  it("combines both rankings and marks query words", async () => {
    const { cosine } = await engine({ loadModel: "eager" });
    await cosine.warmup();
    const [first] = await cosine.search("change subscription plan");
    expect(first?.chunk.headings).toEqual(["Change your plan"]);
    expect(first?.matchedBy).toEqual(["lexical", "semantic"]);
    const marked = first?.highlights.map(([s, e]) => first.snippet.slice(s, e).toLowerCase());
    expect(marked).toContain("subscription");
  });

  it("drops weak semantic hits below minSimilarity", async () => {
    const { cosine } = await engine({ minSimilarity: 0.99 });
    await cosine.warmup();
    expect(await cosine.search("erase app", { mode: "semantic" })).toEqual([]);
  });

  it("stays lexical with loadModel never or without an embedder", async () => {
    const { cosine } = await engine({ loadModel: "never" });
    await cosine.warmup();
    expect(cosine.status).toBe("lexical");
    expect(cosine.semantic).toBe(false);
    expect(await cosine.search("erase app")).toEqual([]);
  });

  it("falls back to lexical when the model fails", async () => {
    const { built } = await engine();
    const vectors = VectorStore.fromBuffer(
      (built.vectors as Uint8Array).slice().buffer as ArrayBuffer,
    );
    const broken = {
      model: "toy-model",
      embed: vi.fn().mockRejectedValue(new Error("offline")),
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cosine = new Cosine({
      manifest: built.manifest,
      vectors,
      embedder: broken,
    });
    await cosine.warmup();
    expect(cosine.status).toBe("model-failed");
    expect((await cosine.search("invoices", { mode: "semantic" }))[0]?.matchedBy).toEqual([
      "lexical",
    ]);
    warn.mockRestore();
  });

  it("refuses an embedder for a different model", async () => {
    const { built } = await engine();
    const vectors = VectorStore.fromBuffer(
      (built.vectors as Uint8Array).slice().buffer as ArrayBuffer,
    );
    expect(
      () =>
        new Cosine({
          manifest: built.manifest,
          vectors,
          embedder: toyEmbedder("other"),
        }),
    ).toThrow(/built with toy-model/);
  });
});

describe("files", () => {
  it("writes an index and loads it via fetch and from disk", async () => {
    const out = await mkdtemp(join(tmpdir(), "cosine-"));
    const { files } = await buildDirectory(DOCS, out, {
      baseUrl: "/docs",
      embedder: toyEmbedder(),
    });
    expect(files.map((f) => f.slice(out.length + 1))).toEqual([
      "cosine-index.json",
      "cosine-vectors.bin",
    ]);

    const fakeFetch = vi.fn(async (url: string) => {
      const body = await readFile(join(out, url.replace("/cosine/", "")));
      return new Response(body);
    });
    const viaFetch = await loadIndex("/cosine/cosine-index.json", {
      fetch: fakeFetch as unknown as typeof fetch,
      embedder: toyEmbedder(),
    });
    expect(fakeFetch.mock.calls.map((c) => c[0])).toEqual([
      "/cosine/cosine-index.json",
      "/cosine/cosine-vectors.bin",
    ]);
    await viaFetch.warmup();
    expect((await viaFetch.search("erase app"))[0]?.chunk.url).toBe("/docs/#uninstall");

    const fromDisk = await loadIndexFile(join(out, "cosine-index.json"), {
      embedder: toyEmbedder(),
    });
    expect(fromDisk.chunks).toHaveLength(viaFetch.chunks.length);
  });

  it("builds a lexical-only index with the CLI and searches it", async () => {
    const out = await mkdtemp(join(tmpdir(), "cosine-cli-"));
    const lines: string[] = [];
    const log = (line: string) => lines.push(line);
    expect(
      await run(["build", DOCS, "--out", out, "--lexical-only", "--base-url", "/docs"], log),
    ).toBe(0);
    expect(lines[0]).toMatch(/Indexed 3 pages as \d+ chunks .*\(lexical only\)/);
    const manifest = JSON.parse(await readFile(join(out, "cosine-index.json"), "utf8"));
    expect(manifest).toMatchObject({ version: 1, model: null, vectors: null });

    lines.length = 0;
    expect(await run(["search", out, "invoices", "--mode", "lexical"], log)).toBe(0);
    expect(lines[0]).toContain("Billing > Invoices");
    expect(lines[1]).toContain("/docs/guides/billing#invoices");
    expect(await run(["nope"], () => {})).toBe(1);
  });

  it("stores synonyms from the CLI in the index", async () => {
    const out = await mkdtemp(join(tmpdir(), "cosine-syn-"));
    const file = join(out, "synonyms.json");
    await writeFile(file, JSON.stringify({ receipts: ["invoices"] }));
    const lines: string[] = [];
    expect(
      await run(["build", DOCS, "--out", out, "--lexical-only", "--synonyms", file], (l) =>
        lines.push(l),
      ),
    ).toBe(0);
    const manifest = JSON.parse(await readFile(join(out, "cosine-index.json"), "utf8"));
    expect(manifest.synonyms).toEqual([["receipts", "invoices"]]);
    lines.length = 0;
    await run(["search", out, "receipts", "--mode", "lexical"], (l) => lines.push(l));
    expect(lines[0]).toContain("Billing > Invoices");

    await writeFile(file, "{ nope");
    expect(await run(["build", DOCS, "--out", out, "--synonyms", file], () => {})).toBe(1);
    expect(() => parseSynonyms([["a", 1]])).toThrow(/expected/);
  });

  it("reuses the vectors of unchanged sections", async () => {
    const docs = await readDocs(DOCS, { baseUrl: "/docs" });
    const first = await buildIndex(docs, { embedder: toyEmbedder() });
    const previous = {
      manifest: first.manifest,
      vectors: VectorStore.fromBuffer((first.vectors as Uint8Array).slice().buffer as ArrayBuffer),
    };
    const changed = docs.map((d, i) =>
      i === 0 ? { ...d, content: `${d.content}\n\nNew line.` } : d,
    );
    const embedder = toyEmbedder();
    const second = await buildIndex(changed, { embedder, previous });
    expect(second.embedded).toBeGreaterThan(0);
    expect(second.reused).toBe(second.manifest.chunks.length - second.embedded);
    expect(second.reused).toBeGreaterThan(0);

    const full = await buildIndex(changed, { embedder: toyEmbedder() });
    const a = VectorStore.fromBuffer((second.vectors as Uint8Array).slice().buffer as ArrayBuffer);
    const b = VectorStore.fromBuffer((full.vectors as Uint8Array).slice().buffer as ArrayBuffer);
    for (let k = 0; k < a.count; k++) {
      expect(cosineSimilarity(a.vector(k), b.vector(k))).toBeCloseTo(1, 4);
    }

    const other = await buildIndex(changed, {
      embedder: toyEmbedder("other"),
      previous,
    });
    expect(other.reused).toBe(0);
  });

  it("builds incrementally with the CLI", async () => {
    const out = await mkdtemp(join(tmpdir(), "cosine-inc-"));
    await buildDirectory(DOCS, out, { embedder: toyEmbedder() });
    const previous = await readIndex(out);
    expect(previous?.vectors?.count).toBe(previous?.manifest.chunks.length);
    expect(await readIndex(join(out, "missing"))).toBeNull();
  });
});
