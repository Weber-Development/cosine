// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildIndex } from "../src/build";
import { defineCosineSearch } from "../src/element";
import { Cosine } from "../src/search";

defineCosineSearch();

async function mount(lang?: string) {
  const { manifest } = await buildIndex([
    {
      id: "a",
      url: "/docs/a",
      title: "Billing",
      content: "## Invoices\n\nInvoices arrive monthly.\n\n## Plans\n\nChange your plan.",
    },
    { id: "b", url: "/docs/b", title: "Install", content: "Run npm install." },
  ]);
  const el = document.createElement("cosine-search");
  if (lang) el.setAttribute("lang", lang);
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
    expect(options[0]?.querySelector("a")?.getAttribute("href")).toBe("/docs/a#invoices");
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
      selected = (e as CustomEvent).detail.chunk.url;
      e.preventDefault();
    });
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true }));
    expect(selected).toBe("/docs/a#plans");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(input.getAttribute("aria-expanded")).toBe("false");
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
});
