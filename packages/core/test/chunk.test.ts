import { describe, expect, it } from "vitest";
import { chunkMarkdown, htmlToMarkdown, parseFrontMatter, slugify } from "../src/chunk";

const doc = (content: string) => ({ id: "a.md", url: "/docs/a", title: "a", content });

describe("chunkMarkdown", () => {
  it("splits at headings, keeps anchors and the heading path", () => {
    const chunks = chunkMarkdown(
      doc(
        `# Getting started\n\nIntro text.\n\n## Install\n\nRun it.\n\n### With pnpm\n\nUse pnpm.\n\n## Install\n\nAgain.`,
      ),
    );
    expect(chunks.map((c) => [c.url, c.headings, c.text])).toEqual([
      ["/docs/a", [], "Intro text."],
      ["/docs/a#install", ["Install"], "Run it."],
      ["/docs/a#with-pnpm", ["Install", "With pnpm"], "Use pnpm."],
      ["/docs/a#install-1", ["Install"], "Again."],
    ]);
    expect(chunks.every((c) => c.title === "Getting started")).toBe(true);
    expect(chunks.map((c) => c.id)).toEqual([0, 1, 2, 3]);
  });

  it("uses the front matter title and strips MDX imports, links and emphasis", () => {
    const [chunk] = chunkMarkdown(
      doc(
        `---\ntitle: "Hello"\n---\nimport X from "./x";\n\nSee **the** [guide](/g) and \`code\`.`,
      ),
    );
    expect(chunk?.title).toBe("Hello");
    expect(chunk?.text).toBe("See the guide and code.");
  });

  it("keeps or drops code blocks and ignores headings inside them", () => {
    const md = "## A\n\n```sh\n# not a heading\nnpm i\n```\n\nText.";
    expect(chunkMarkdown(doc(md))).toHaveLength(1);
    expect(chunkMarkdown(doc(md))[0]?.text).toContain("npm i");
    expect(chunkMarkdown(doc(md), { code: "drop" })[0]?.text).toBe("Text.");
  });

  it("splits long sections at paragraphs and sentences", () => {
    const para = "This is a sentence about search. ".repeat(20).trim();
    const chunks = chunkMarkdown(doc(`## Long\n\n${para}\n\n${para}`), { maxChars: 300 });
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((c) => c.text.length <= 340)).toBe(true);
    expect(chunks.every((c) => c.url === "/docs/a#long")).toBe(true);
  });

  it("supports custom heading ids", () => {
    expect(chunkMarkdown(doc("## Rollen {#roles}\n\nText"))[0]?.url).toBe("/docs/a#roles");
  });
});

describe("helpers", () => {
  it("slugifies like GitHub", () => {
    expect(slugify("Install with pnpm!")).toBe("install-with-pnpm");
    expect(slugify("Grösse & Gewicht")).toBe("grösse--gewicht");
  });

  it("parses front matter", () => {
    expect(parseFrontMatter("---\ntitle: X\n---\nbody")).toEqual({ title: "X", body: "body" });
    expect(parseFrontMatter("body")).toEqual({ body: "body" });
  });

  it("extracts the main content of HTML", () => {
    const { title, markdown } = htmlToMarkdown(
      `<title>T</title><nav>menu</nav><main><h1>Page</h1><h2 id="x">Sub &amp; more</h2><p>A&nbsp;b</p><script>bad()</script></main>`,
    );
    expect(title).toBe("T");
    expect(markdown).toContain("# Page");
    expect(markdown).toContain("## Sub & more {#x}");
    expect(markdown).not.toContain("menu");
    expect(markdown).not.toContain("bad()");
  });
});
