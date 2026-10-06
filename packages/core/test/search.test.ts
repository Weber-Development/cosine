import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildIndex } from "../src/build";
import { parseBoost, parseSynonyms, run } from "../src/cli";
import { CosineGroup, loadIndexes } from "../src/group";
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

  it("applies operators in every mode and ranks boosted paths higher", async () => {
    const { cosine, built } = await engine();
    await cosine.warmup();
    expect((await cosine.search("invoices -plan", { mode: "lexical" }))[0]?.chunk.url).toContain(
      "#invoices",
    );
    const semantic = await cosine.search("uninstall -daemon", { mode: "semantic" });
    expect(semantic.every((r) => !/daemon/i.test(r.chunk.text))).toBe(true);
    expect((await cosine.search('"any time"', { mode: "hybrid" })).length).toBe(1);

    const plain = cosine.searchLexical("plan invoices", { limit: 5 });
    const boosted = new Cosine({
      manifest: { ...built.manifest, boost: { "/docs/": 1, "/docs/guides/billing#invoices": 5 } },
    }).searchLexical("plan invoices", { limit: 5 });
    expect(boosted[0]?.chunk.url).toBe("/docs/guides/billing#invoices");
    expect(boosted.map((r) => r.chunk.id).sort()).toEqual(plain.map((r) => r.chunk.id).sort());
  });

  it("stores --boost from the CLI and validates it", async () => {
    const out = await mkdtemp(join(tmpdir(), "cosine-boost-"));
    expect(
      await run(
        ["build", DOCS, "--out", out, "--lexical-only", "--boost", "/docs/guides=2"],
        () => {},
      ),
    ).toBe(0);
    const manifest = JSON.parse(await readFile(join(out, "cosine-index.json"), "utf8"));
    expect(manifest.boost).toEqual({ "/docs/guides": 2 });
    expect(parseBoost(["/a=0.5", "/b/c=3"])).toEqual({ "/a": 0.5, "/b/c": 3 });
    expect(() => parseBoost(["/a=0"])).toThrow(/--boost/);
    expect(() => parseBoost(["nope"])).toThrow(/--boost/);
    expect(await run(["build", DOCS, "--out", out, "--boost", "x=y"], () => {})).toBe(1);
  });

  it("counts results per section of the site", async () => {
    const { cosine } = await engine();
    const byPage = await cosine.facets("team invoices", { mode: "lexical", depth: 2 });
    expect(byPage.length).toBeGreaterThan(0);
    expect(byPage.every((f) => f.path.startsWith("/docs/"))).toBe(true);
    const sorted = [...byPage].sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
    expect(byPage).toEqual(sorted);

    const top = await cosine.facets("team invoices", { mode: "lexical" });
    expect(top.map((f) => f.path)).toEqual(["/docs"]);
    expect(top[0]?.count).toBe(byPage.reduce((n, f) => n + f.count, 0));

    const scoped = await cosine.facets("team invoices", {
      mode: "lexical",
      depth: 2,
      scope: "/docs/guides/billing",
    });
    expect(scoped.map((f) => f.path)).toEqual(["/docs/guides"]);
    expect(await cosine.facets("zzzzqq", { mode: "lexical" })).toEqual([]);
    // the paths work as scope
    const first = byPage[0] as { path: string; count: number };
    const inFacet = cosine.searchLexical("team invoices", { scope: first.path, limit: 50 });
    expect(inFacet).toHaveLength(first.count);
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

describe("CosineGroup", () => {
  const blog = [
    { id: "x", url: "/blog/x", title: "Invoices explained", content: "## Why\n\nInvoices matter." },
    { id: "y", url: "/blog/y", title: "Hello", content: "A first post about plans." },
  ];

  async function group(options: ConstructorParameters<typeof CosineGroup>[1] = {}) {
    const { cosine: docs } = await engine();
    const { manifest } = await buildIndex(blog);
    return { docs, group: new CosineGroup([docs, new Cosine({ manifest })], options) };
  }

  it("merges the results of several indexes by rank", async () => {
    const { group: g } = await group();
    const results = g.searchLexical("invoices", { limit: 10 });
    const urls = results.map((r) => r.chunk.url);
    expect(urls).toContain("/docs/guides/billing#invoices");
    expect(urls).toContain("/blog/x#why");
    expect(new Set(results.map((r) => r.index))).toEqual(new Set([0, 1]));
    expect(g.chunks.length).toBeGreaterThan(4);
    expect((await g.search("invoices", { mode: "lexical", limit: 1 })).length).toBe(1);
  });

  it("weights an index higher and reports a combined status", async () => {
    const { group: heavy } = await group({ weights: [1, 5] });
    expect(heavy.searchLexical("invoices", { limit: 5 })[0]?.index).toBe(1);
    expect(heavy.status).toBe("lexical");
    expect(heavy.semantic).toBe(true);
    const statuses: string[] = [];
    heavy.onStatus((s) => statuses.push(s));
    await heavy.warmup();
    expect(statuses).toEqual(["loading-model", "ready"]);
    expect(heavy.status).toBe("ready");
    expect(() => new CosineGroup([])).toThrow(/at least one/);
  });

  it("counts facets across indexes and loads several URLs", async () => {
    const { group: g } = await group();
    expect(await g.facets("invoices", { mode: "lexical" })).toEqual([
      { path: "/blog", count: 1 },
      { path: "/docs", count: 1 },
    ]);
    const out = await mkdtemp(join(tmpdir(), "cosine-group-"));
    await run(
      ["build", DOCS, "--out", join(out, "a"), "--lexical-only", "--base-url", "/docs"],
      () => {},
    );
    await run(
      ["build", DOCS, "--out", join(out, "b"), "--lexical-only", "--base-url", "/more"],
      () => {},
    );
    const fakeFetch = (async (url: string) =>
      new Response(await readFile(join(out, url.replace("/", ""))))) as unknown as typeof fetch;
    const loaded = await loadIndexes(["/a/cosine-index.json", "/b/cosine-index.json"], {
      fetch: fakeFetch,
      embedder: false,
    });
    expect(loaded.members).toHaveLength(2);
    expect(loaded.searchLexical("invoices", { limit: 10 }).map((r) => r.chunk.url)).toEqual(
      expect.arrayContaining(["/docs/guides/billing#invoices", "/more/guides/billing#invoices"]),
    );
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
