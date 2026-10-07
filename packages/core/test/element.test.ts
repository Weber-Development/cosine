// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildIndex } from "../src/build";
import { defineCosineSearch } from "../src/element";
import { Cosine } from "../src/search";

defineCosineSearch();

async function mount(lang?: string, attrs: Record<string, string> = {}, withBlog = false) {
  const { manifest } = await buildIndex([
    {
      id: "a",
      url: "/docs/a",
      title: "Billing",
      content: "## Invoices\n\nInvoices arrive monthly.\n\n## Plans\n\nChange your plan.",
    },
    { id: "b", url: "/docs/b", title: "Install", content: "Run npm install." },
    ...(withBlog
      ? [
          {
            id: "c",
            url: "/blog/c",
            title: "Invoices news",
            content: "## Invoices\n\nNew invoices layout.",
          },
        ]
      : []),
  ]);
  const el = document.createElement("cosine-search");
  if (lang) el.setAttribute("lang", lang);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.cosine = new Cosine({ manifest });
  document.body.append(el);
  const root = el.shadowRoot as ShadowRoot;
  const input = root.querySelector("input") as HTMLInputElement;
  const type = async (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event("input"));
    await new Promise((r) => setTimeout(r, 0));
  };
  return { el, root, input, type };
}

describe("<cosine-search>", () => {
  it("is an ARIA combobox that lists results while typing", async () => {
    const { root, input, type } = await mount();
    expect(input.getAttribute("role")).toBe("combobox");
    expect(input.getAttribute("aria-label")).toBe("Search the docs");
    await type("invoic");
    const options = root.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(1);
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(options[0]?.getAttribute("href")).toBe("/docs/a#invoices");
    expect(options[0]?.querySelector("mark")?.textContent).toBe("Invoices");
    expect(root.querySelector('[role="status"]')?.textContent).toBe("1 results");
  });

  it("moves the active option with the arrow keys and fires cosine-select", async () => {
    const { el, root, input, type } = await mount();
    await type("plan");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    const option = root.querySelector('[role="option"]') as HTMLElement;
    expect(option.getAttribute("aria-selected")).toBe("true");
    expect(input.getAttribute("aria-activedescendant")).toBe(option.id);
    let selected = "";
    el.addEventListener("cosine-select", (e) => {
      selected = `${e.detail.chunk.url} ${e.detail.query} ${e.detail.rank}`;
      e.preventDefault();
    });
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true }));
    expect(selected).toBe("/docs/a#plans plan 1");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("reports every result list with cosine-results", async () => {
    const { el, type } = await mount();
    const seen: string[] = [];
    el.addEventListener("cosine-results", (e) =>
      seen.push(`${e.detail.query}:${e.detail.results.length}`),
    );
    await type("invoices");
    await type("xyzzy");
    expect(seen).toEqual(["invoices:1", "xyzzy:0"]);
  });

  it("speaks German and reports no results", async () => {
    const { root, input, type } = await mount("de-CH");
    expect(input.placeholder).toBe("Dokumentation durchsuchen…");
    await type("xyzzy");
    expect(root.querySelector(".empty")?.textContent).toBe("Keine Treffer");
  });

  it("focuses on the / shortcut", async () => {
    const { root, input } = await mount();
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true }),
    );
    expect(root.activeElement).toBe(input);
  });

  it("offers filter buttons per section with facets", async () => {
    const { root, input, type } = await mount("en", { facets: "" }, true);
    await type("invoices");
    await new Promise((r) => setTimeout(r, 0));
    const bar = root.querySelector(".facets") as HTMLElement;
    expect(bar.hidden).toBe(false);
    const buttons = [...bar.querySelectorAll("button")];
    expect(buttons.map((b) => b.textContent)).toEqual(["All (2)", "blog (1)", "docs (1)"]);
    expect(buttons[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(root.querySelectorAll('[role="option"]')).toHaveLength(2);

    buttons[1]?.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(root.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(root.querySelector('[role="option"]')?.getAttribute("href")).toBe("/blog/c#invoices");
    const after = [...root.querySelectorAll(".facets button")];
    expect(after[1]?.getAttribute("aria-pressed")).toBe("true");
    expect(after).toHaveLength(3);
    expect(input.getAttribute("aria-expanded")).toBe("true");

    await type("");
    expect((root.querySelector(".facets") as HTMLElement).hidden).toBe(true);
  });

  it("hides the filter buttons when there is a single section", async () => {
    const { root, type } = await mount("de", { facets: "" });
    await type("npm install");
    await new Promise((r) => setTimeout(r, 0));
    expect((root.querySelector(".facets") as HTMLElement).hidden).toBe(true);
  });
});
