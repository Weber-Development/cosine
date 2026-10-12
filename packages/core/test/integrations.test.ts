import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import cosineAstro from "../src/integrations/astro";
import cosineDocusaurus from "../src/integrations/docusaurus";
import { cosineBuildEnd } from "../src/integrations/vitepress";
import { loadIndexFile } from "../src/node";

async function site() {
  const dir = await mkdtemp(join(tmpdir(), "cos-site-"));
  await mkdir(join(dir, "docs"), { recursive: true });
  await writeFile(
    join(dir, "docs", "install.html"),
    "<html><head><title>Install</title></head><body><h1>Install</h1><p>Run the installer to uninstall old versions.</p></body></html>",
  );
  return dir;
}

async function search(dir: string) {
  const cosine = await loadIndexFile(join(dir, "cosine", "cosine-index.json"), {
    loadModel: "never",
  });
  return cosine.searchLexical("installer")[0]?.chunk.url;
}

describe("site integrations", () => {
  it("Docusaurus indexes the build folder after the build", async () => {
    const dir = await site();
    const plugin = cosineDocusaurus({}, { model: false, log: () => {} });
    expect(plugin.name).toBe("cosine-search");
    await plugin.postBuild({ outDir: dir, baseUrl: "/" });
    expect(await search(dir)).toBe("/docs/install");
  });

  it("Astro indexes dist after astro:build:done", async () => {
    const dir = await site();
    const integration = cosineAstro({ model: false, log: () => {}, baseUrl: "/site/" });
    await integration.hooks["astro:build:done"]({ dir: pathToFileURL(`${dir}/`) });
    expect(await search(dir)).toBe("/site/docs/install");
  });

  it("VitePress indexes outDir in buildEnd and honours the base", async () => {
    const dir = await site();
    await cosineBuildEnd({ model: false, log: () => {}, out: "search" })({
      outDir: dir,
      site: { base: "/kb/" },
    });
    const cosine = await loadIndexFile(join(dir, "search", "cosine-index.json"), {
      loadModel: "never",
    });
    expect(cosine.searchLexical("installer")[0]?.chunk.url).toBe("/kb/docs/install");
    expect(
      JSON.parse(await readFile(join(dir, "search", "cosine-index.json"), "utf8")).version,
    ).toBe(2);
  });
});
