import { buildIndex, Cosine } from "@sweberdev/cosine";
import { act, render, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CosineSearch, useCosine, useCosineSearch } from "../src";

async function engine() {
  const { manifest } = await buildIndex([
    { id: "a", url: "/a", title: "Billing", content: "## Invoices\n\nInvoices arrive monthly." },
    { id: "b", url: "/b", title: "Install", content: "Run npm install." },
  ]);
  return { manifest, cosine: new Cosine({ manifest }) };
}

describe("useCosineSearch", () => {
  it("returns lexical results for the query", async () => {
    const { cosine } = await engine();
    const { result, rerender } = renderHook(({ q }) => useCosineSearch(cosine, q), {
      initialProps: { q: "invoices" },
    });
    expect(result.current.results[0]?.chunk.url).toBe("/a#invoices");
    rerender({ q: "" });
    expect(result.current.results).toEqual([]);
  });
});

describe("useCosine", () => {
  it("loads an index by URL", async () => {
    const { manifest } = await engine();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(manifest)));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCosine("/cosine/cosine-index.json"));
    await waitFor(() => expect(result.current.cosine).not.toBeNull());
    expect(result.current.cosine?.chunks).toHaveLength(2);
    expect(result.current.status).toBe("lexical");
    vi.unstubAllGlobals();
  });
});

describe("<CosineSearch>", () => {
  it("renders the web component with the engine and forwards selection", async () => {
    const { cosine } = await engine();
    const onSelect = vi.fn(() => false);
    const { container } = render(
      <CosineSearch cosine={cosine} lang="de" limit={3} onSelect={onSelect} />,
    );
    const el = container.querySelector("cosine-search") as HTMLElement & { cosine: Cosine };
    expect(el.getAttribute("lang")).toBe("de");
    expect(el.getAttribute("limit")).toBe("3");
    expect(el.cosine).toBe(cosine);
    const input = el.shadowRoot?.querySelector("input") as HTMLInputElement;
    await act(async () => {
      input.value = "install";
      input.dispatchEvent(new Event("input"));
      await new Promise((r) => setTimeout(r, 0));
    });
    ((el.shadowRoot as ShadowRoot).querySelector('[role="option"]') as HTMLAnchorElement).click();
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ chunk: expect.objectContaining({ url: "/b" }) }),
    );
  });
});
