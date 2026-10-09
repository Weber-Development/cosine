// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { run } from "../src/cli";
import * as element from "../src/element";
import * as core from "../src/index";
import * as node from "../src/node";

// The public API of 1.x. Adding a name is a minor change and means adding it here on purpose.
// Removing or renaming a name is a breaking change: do not edit these lists to make a test pass.
// See docs/reference/stability.md.

describe("API surface (frozen for 1.x)", () => {
  it("@sweberdev/cosine exports exactly these runtime names", () => {
    expect(Object.keys(core).sort()).toEqual([
      "Cosine",
      "CosineGroup",
      "DEFAULT_MODEL",
      "LexicalIndex",
      "MODELS",
      "TEXTS",
      "VectorStore",
      "buildIndex",
      "chunkMarkdown",
      "cosineSimilarity",
      "countFacets",
      "editDistance",
      "fuse",
      "highlightParts",
      "htmlToMarkdown",
      "loadIndex",
      "loadIndexes",
      "makeSnippet",
      "normalize",
      "normalizeVector",
      "parseFrontMatter",
      "parseQuery",
      "passageText",
      "scopeFilter",
      "siblingUrl",
      "slugify",
      "textsFor",
      "tokenize",
      "transformersEmbedder",
    ]);
  });

  it("@sweberdev/cosine/node exports exactly these runtime names", () => {
    expect(Object.keys(node).sort()).toEqual([
      "buildDirectory",
      "buildIndex",
      "fileUrl",
      "loadIndexFile",
      "passageText",
      "readDocs",
      "readIndex",
      "writeIndex",
    ]);
  });

  it("@sweberdev/cosine/element exports exactly these runtime names", () => {
    expect(Object.keys(element).sort()).toEqual(["CosineSearchElement", "defineCosineSearch"]);
  });

  it("the Cosine and CosineGroup methods stay", () => {
    for (const type of [core.Cosine, core.CosineGroup]) {
      for (const name of ["search", "searchLexical", "facets", "warmup", "onStatus"]) {
        expect(typeof type.prototype[name as keyof typeof type.prototype], name).toBe("function");
      }
      expect(Object.getOwnPropertyDescriptor(type.prototype, "status")?.get).toBeTypeOf("function");
    }
  });

  it("<cosine-search> keeps its observed attributes, parts and events", async () => {
    expect(element.CosineSearchElement.observedAttributes).toEqual([
      "index",
      "lang",
      "placeholder",
    ]);
    element.defineCosineSearch();
    const el = document.createElement("cosine-search");
    document.body.append(el);
    const parts = [...(el.shadowRoot?.querySelectorAll("[part]") ?? [])].map((n) =>
      n.getAttribute("part"),
    );
    expect(parts).toEqual(
      expect.arrayContaining([
        "field",
        "input",
        "shortcut",
        "panel",
        "facets",
        "results",
        "status",
      ]),
    );
    el.remove();
  });

  it("the CLI keeps its commands and options", async () => {
    const lines: string[] = [];
    expect(await run(["--help"], (line) => lines.push(line))).toBe(0);
    const help = lines.join("\n");
    for (const text of [
      "cosine build <docs-dir>",
      "cosine search <index-dir> <query>",
      "--out <dir>",
      "--base-url <path>",
      "--model <id>",
      "--lexical-only",
      "--exclude <path>",
      "--max-chars <n>",
      "--query-prefix <s>",
      "--passage-prefix <s>",
      "--synonyms <file>",
      "--boost <path=n>",
      "--incremental",
      "--mode <mode>",
      "--limit <n>",
    ]) {
      expect(help, text).toContain(text);
    }
  });
});
