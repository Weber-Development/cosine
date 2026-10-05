import { describe, expect, it } from "vitest";
import { buildIndex } from "../src/build";
import { transformersEmbedder } from "../src/embedder";
import { readDocs } from "../src/node";
import { Cosine } from "../src/search";
import { VectorStore } from "../src/vectors";

// Downloads the real default model (about 23 MB), so it runs only when COSINE_E2E=1 (in CI).
describe.runIf(process.env.COSINE_E2E === "1")("real model", () => {
  it("finds documentation by meaning with the default model", async () => {
    const docs = await readDocs(`${import.meta.dirname}/fixtures/docs`, { baseUrl: "/docs" });
    const embedder = transformersEmbedder();
    const built = await buildIndex(docs, { embedder });
    expect(built.manifest.model).toBe("Xenova/all-MiniLM-L6-v2");
    expect(built.manifest.dimensions).toBe(384);
    const vectors = VectorStore.fromBuffer(
      (built.vectors as Uint8Array).slice().buffer as ArrayBuffer,
    );
    const cosine = new Cosine({ manifest: built.manifest, vectors, loadModel: "eager" });
    await cosine.warmup();
    expect(cosine.status).toBe("ready");

    const uninstall = await cosine.search("how do I get rid of the app", { mode: "semantic" });
    expect(uninstall[0]?.chunk.url).toBe("/docs/#uninstall");
    const billing = await cosine.search("where is my receipt", { groupByPage: true });
    expect(billing[0]?.chunk.url).toBe("/docs/guides/billing#invoices");
    const team = await cosine.search("add a coworker", { groupByPage: true });
    expect(team[0]?.chunk.title).toBe("Team members");
  }, 300_000);
});
