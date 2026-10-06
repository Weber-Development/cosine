import { type CosineGroup, loadIndexes } from "./group";
import { type Cosine, loadIndex } from "./search";
import { highlightParts } from "./snippet";
import { type SearchTexts, textsFor } from "./texts";
import type { SearchResult } from "./types";

const STYLE = `
:host { display: block; position: relative; font: inherit; color: var(--cosine-text, CanvasText);
  --_accent: var(--cosine-accent, #2563eb); --_bg: var(--cosine-bg, Canvas);
  --_border: var(--cosine-border, color-mix(in srgb, currentColor 25%, transparent));
  --_muted: var(--cosine-muted, color-mix(in srgb, currentColor 65%, transparent)); }
.field { position: relative; }
input { box-sizing: border-box; width: 100%; font: inherit; color: inherit; background: var(--_bg);
  border: 1px solid var(--_border); border-radius: var(--cosine-radius, 8px); padding: .6em 2.6em .6em .8em; }
input:focus-visible { outline: 2px solid var(--_accent); outline-offset: 1px; }
.field:focus-within kbd { display: none; }
input::-webkit-search-cancel-button { cursor: pointer; }
kbd { position: absolute; right: .6em; top: 50%; transform: translateY(-50%); font: inherit; font-size: .75em;
  color: var(--_muted); border: 1px solid var(--_border); border-radius: 4px; padding: 0 .35em; pointer-events: none; }
.panel { position: absolute; z-index: var(--cosine-z, 50); left: 0; right: 0; margin: .3em 0 0; padding: .3em;
  background: var(--_bg); border: 1px solid var(--_border); border-radius: var(--cosine-radius, 8px);
  box-shadow: 0 8px 24px rgb(0 0 0 / .12); }
.panel[hidden] { display: none; }
[role="listbox"] { margin: 0; padding: 0; list-style: none; max-height: var(--cosine-max-height, 60vh); overflow: auto; }
[role="listbox"][hidden] { display: none; }
[role="option"] a { display: block; padding: .55em .7em; border-radius: calc(var(--cosine-radius, 8px) - 2px);
  color: inherit; text-decoration: none; }
[role="option"][aria-selected="true"] a, [role="option"] a:hover { background: color-mix(in srgb, var(--_accent) 12%, transparent); }
.path { display: block; font-weight: 600; }
.snippet { display: block; font-size: .875em; color: var(--_muted); margin-top: .15em; }
mark { background: none; color: var(--_accent); font-weight: 600; }
.facets { display: flex; flex-wrap: wrap; gap: .4em; margin: 0; padding: .3em .3em .1em; list-style: none; }
.facets[hidden] { display: none; }
.facets button { font: inherit; font-size: .8em; color: inherit; background: none; cursor: pointer;
  border: 1px solid var(--_border); border-radius: 999px; padding: .15em .7em; }
.facets button[aria-pressed="true"] { background: var(--_accent); border-color: var(--_accent); color: var(--_bg); }
.facets button:focus-visible { outline: 2px solid var(--_accent); outline-offset: 1px; }
.empty, .status { padding: .55em .7em; color: var(--_muted); font-size: .875em; }
.status { padding: .3em 0 0; min-height: 1.2em; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (prefers-reduced-motion: no-preference) { [role="option"] a { transition: background .1s; } }
`;

type Engine = Cosine | CosineGroup;

let counter = 0;

/** `detail` of the `cosine-select` event. */
export interface CosineSelectDetail extends SearchResult {
  /** The query that produced the result. */
  query: string;
  /** Position in the list, starting at 1. */
  rank: number;
}

/** `detail` of the `cosine-results` event. */
export interface CosineResultsDetail {
  query: string;
  results: SearchResult[];
}

/**
 * `<cosine-search index="/cosine/cosine-index.json">`: an accessible search field (ARIA combobox)
 * with results while typing.
 *
 * Attributes: `index` (URL of `cosine-index.json`, or several separated by spaces to search them
 * as one), `facets` (show filter buttons per section, with `facets="2"` for two path segments), `lang` (`en`, `de`, `fr`, `it`), `limit`,
 * `placeholder`, `shortcut` (`/` or `mod+k`, default `/`), `mode` (`hybrid`, `lexical`),
 * `load-model` (`lazy`, `eager`, `never`), `scope` (space-separated URL paths, e.g. `/docs/api`, to
 * search only part of the site). Styling via `--cosine-*` custom properties and `::part`.
 * Fires `cosine-results` with `{ query, results }` after each search, and `cosine-select` with the
 * chosen result (plus `query` and `rank`) before navigating; call `preventDefault()` on it to
 * handle navigation yourself.
 */
export class CosineSearchElement extends HTMLElement {
  static observedAttributes = ["index", "lang", "placeholder"];

  private engine: Engine | null = null;
  private loading: Promise<Engine> | null = null;
  private facet: string | null = null;
  private results: SearchResult[] = [];
  private query = "";
  private active = -1;
  private seq = 0;
  private readonly uid = `cosine-${++counter}`;
  private readonly root: ShadowRoot;
  private readonly input: HTMLInputElement;
  private readonly list: HTMLUListElement;
  private readonly facetBar: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly live: HTMLDivElement;
  private readonly statusLine: HTMLDivElement;
  private readonly onKeydownGlobal = (e: KeyboardEvent) => this.handleShortcut(e);
  private texts: SearchTexts = textsFor("en");

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
    this.root.innerHTML = `<style>${STYLE}</style>
<div class="field" part="field">
  <input part="input" type="search" role="combobox" autocomplete="off" spellcheck="false"
    aria-autocomplete="list" aria-expanded="false" aria-controls="${this.uid}-list" />
  <kbd part="shortcut" aria-hidden="true"></kbd>
</div>
<div class="panel" part="panel" hidden>
  <div class="facets" part="facets" role="group" hidden></div>
  <ul part="results" role="listbox" id="${this.uid}-list" hidden></ul>
</div>
<div class="status" part="status" aria-hidden="true"></div>
<div class="sr" role="status" aria-live="polite"></div>`;
    this.input = this.root.querySelector("input") as HTMLInputElement;
    this.list = this.root.querySelector("ul") as HTMLUListElement;
    this.facetBar = this.root.querySelector(".facets") as HTMLDivElement;
    this.panel = this.root.querySelector(".panel") as HTMLDivElement;
    this.statusLine = this.root.querySelector(".status") as HTMLDivElement;
    this.live = this.root.querySelector('[role="status"]') as HTMLDivElement;

    this.input.addEventListener("input", () => void this.update());
    this.input.addEventListener("focus", () => {
      void this.ensure().then((c) => c.warmup());
      if (this.results.length) this.open(true);
    });
    this.input.addEventListener("keydown", (e) => this.handleKey(e));
    this.addEventListener("focusout", (e) => {
      if (!this.contains(e.relatedTarget as Node) && !this.root.contains(e.relatedTarget as Node))
        this.open(false);
    });
  }

  /** The search engine. Set it to use an index you loaded yourself. */
  get cosine(): Engine | null {
    return this.engine;
  }

  set cosine(value: Engine | null) {
    this.engine = value;
    this.loading = value ? Promise.resolve(value) : null;
    if (value) this.watch(value);
  }

  connectedCallback() {
    this.applyTexts();
    const shortcut = this.shortcut;
    (this.root.querySelector("kbd") as HTMLElement).textContent =
      shortcut === "mod+k"
        ? /Mac|iPhone|iPad/.test(navigator.platform)
          ? "⌘K"
          : "Ctrl K"
        : shortcut;
    document.addEventListener("keydown", this.onKeydownGlobal);
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this.onKeydownGlobal);
  }

  attributeChangedCallback(name: string) {
    if (name === "index" && this.engine && !this.loading) this.engine = null;
    if (name === "index") this.loading = null;
    this.applyTexts();
  }

  private get shortcut(): string {
    return this.getAttribute("shortcut") ?? "/";
  }

  private applyTexts() {
    this.texts = textsFor(
      this.getAttribute("lang") ?? this.closest("[lang]")?.getAttribute("lang"),
    );
    this.input.placeholder = this.getAttribute("placeholder") ?? this.texts.placeholder;
    this.input.setAttribute("aria-label", this.getAttribute("label") ?? this.texts.label);
    this.list.setAttribute("aria-label", this.getAttribute("label") ?? this.texts.label);
  }

  private ensure(): Promise<Engine> {
    if (this.loading) return this.loading;
    const urls = (this.getAttribute("index") ?? "").split(/\s+/).filter(Boolean);
    if (!urls.length) return Promise.reject(new Error("cosine-search: missing index attribute"));
    const loadModel = (this.getAttribute("load-model") ?? "lazy") as "lazy" | "eager" | "never";
    const loaded =
      urls.length === 1
        ? loadIndex(urls[0] as string, { loadModel })
        : loadIndexes(urls, { loadModel });
    this.loading = loaded.then((c) => {
      this.engine = c;
      this.watch(c);
      return c;
    });
    this.loading.catch((error: unknown) => {
      this.loading = null;
      console.error(error);
    });
    return this.loading;
  }

  private watch(c: Engine) {
    c.onStatus((status) => {
      this.statusLine.textContent =
        status === "loading-model"
          ? this.texts.loadingModel
          : status === "model-failed"
            ? this.texts.modelFailed
            : status === "ready"
              ? this.texts.modelReady
              : "";
      // Re-rank with the model once it is there.
      if (status === "ready" && this.input.value.trim()) void this.update();
    });
  }

  private async update() {
    const query = this.input.value;
    const seq = ++this.seq;
    if (!query.trim()) {
      this.facet = null;
      this.facetBar.hidden = true;
      this.render([]);
      return;
    }
    const engine = await this.ensure();
    const limit = Number(this.getAttribute("limit") ?? 8);
    const mode = this.getAttribute("mode") === "lexical" ? "lexical" : "hybrid";
    const base = this.getAttribute("scope")?.split(/\s+/).filter(Boolean);
    const scope = this.facet ? [this.facet] : base;
    // Lexical results right away, then the hybrid ranking when it differs.
    if (seq === this.seq) this.render(engine.searchLexical(query, { limit, scope }), query);
    if (this.getAttribute("facets") !== null) void this.updateFacets(engine, query, base, seq);
    if (mode === "lexical" || engine.status !== "ready") return;
    const results = await engine.search(query, { limit, mode, scope });
    if (seq === this.seq) this.render(results, query);
  }

  /** Filter buttons with the number of results per section, for the query without the filter. */
  private async updateFacets(
    engine: Engine,
    query: string,
    scope: string[] | undefined,
    seq: number,
  ) {
    const depth = Math.max(1, Number(this.getAttribute("facets")) || 1);
    const facets = await engine.facets(query, { depth, mode: "lexical", scope });
    if (seq !== this.seq) return;
    this.facetBar.replaceChildren();
    // A single section needs no filter, unless one is chosen.
    if (facets.length < 2 && !this.facet) {
      this.facetBar.hidden = true;
      return;
    }
    const total = facets.reduce((n, f) => n + f.count, 0);
    const entries: Array<[string | null, string]> = [
      [null, `${this.texts.all} (${total})`],
      ...facets.map((f): [string, string] => [f.path, `${f.path.slice(1)} (${f.count})`]),
    ];
    this.facetBar.setAttribute("aria-label", this.texts.sections);
    for (const [path, label] of entries) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.setAttribute("aria-pressed", String(path === this.facet));
      button.addEventListener("mousedown", (e) => e.preventDefault());
      button.addEventListener("click", () => {
        this.facet = path;
        void this.update();
      });
      this.facetBar.append(button);
    }
    this.facetBar.hidden = false;
  }

  private render(results: SearchResult[], query = "") {
    this.results = results;
    this.query = query;
    this.active = -1;
    this.input.removeAttribute("aria-activedescendant");
    this.list.replaceChildren();
    if (!query.trim()) {
      this.open(false);
      this.live.textContent = "";
      return;
    }
    if (!results.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.setAttribute("role", "presentation");
      li.textContent = this.texts.noResults;
      this.list.append(li);
    }
    results.forEach((result, i) => {
      const li = document.createElement("li");
      li.id = `${this.uid}-opt-${i}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      li.setAttribute("part", "result");
      const a = document.createElement("a");
      a.href = result.chunk.url;
      a.tabIndex = -1;
      const path = document.createElement("span");
      path.className = "path";
      path.setAttribute("part", "result-title");
      path.textContent = [result.chunk.title, ...result.chunk.headings].join(" › ");
      const snippet = document.createElement("span");
      snippet.className = "snippet";
      snippet.setAttribute("part", "result-snippet");
      for (const part of highlightParts(result.snippet, result.highlights)) {
        if (part.match) {
          const mark = document.createElement("mark");
          mark.textContent = part.text;
          snippet.append(mark);
        } else snippet.append(part.text);
      }
      a.append(path, snippet);
      a.addEventListener("click", (e) => this.select(result, e));
      li.append(a);
      this.list.append(li);
    });
    this.open(true);
    this.dispatchEvent(
      new CustomEvent("cosine-results", {
        detail: { query, results },
        bubbles: true,
        composed: true,
      }),
    );
    this.live.textContent = results.length
      ? this.texts.results.replace("{count}", String(results.length))
      : this.texts.noResults;
  }

  private open(open: boolean) {
    this.list.hidden = !open;
    this.panel.hidden = !open;
    this.input.setAttribute("aria-expanded", String(open));
  }

  private move(delta: number) {
    if (!this.results.length) return;
    this.open(true);
    const options = this.list.querySelectorAll('[role="option"]');
    options[this.active]?.setAttribute("aria-selected", "false");
    this.active = (this.active + delta + this.results.length) % this.results.length;
    const current = options[this.active] as HTMLElement | undefined;
    current?.setAttribute("aria-selected", "true");
    current?.scrollIntoView?.({ block: "nearest" });
    if (current) this.input.setAttribute("aria-activedescendant", current.id);
  }

  private handleKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.move(-1);
    } else if (e.key === "Enter") {
      const result =
        this.results[this.active] ?? (this.active === -1 ? this.results[0] : undefined);
      if (result) {
        e.preventDefault();
        this.select(result, e);
      }
    } else if (e.key === "Escape") {
      if (!this.list.hidden) this.open(false);
      else this.input.value = "";
    }
  }

  private handleShortcut(e: KeyboardEvent) {
    const target = e.composedPath()[0] as HTMLElement | undefined;
    const typing =
      target &&
      (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName ?? ""));
    const shortcut = this.shortcut;
    const hit =
      shortcut === "mod+k"
        ? (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"
        : !typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key === shortcut;
    if (hit && shortcut !== "none") {
      e.preventDefault();
      this.input.focus();
    }
  }

  private select(result: SearchResult, e: Event) {
    const detail: CosineSelectDetail = {
      ...result,
      query: this.query,
      rank: this.results.indexOf(result) + 1,
    };
    const event = new CustomEvent("cosine-select", {
      detail,
      cancelable: true,
      bubbles: true,
      composed: true,
    });
    if (!this.dispatchEvent(event)) {
      e.preventDefault();
      return;
    }
    if (e.type !== "click") window.location.assign(result.chunk.url);
    this.open(false);
  }
}

/** Registers `<cosine-search>` (or another tag name). Safe to call more than once and during SSR. */
export function defineCosineSearch(tag = "cosine-search"): void {
  if (typeof customElements === "undefined" || customElements.get(tag)) return;
  customElements.define(tag, class extends CosineSearchElement {});
}

declare global {
  interface HTMLElementTagNameMap {
    "cosine-search": CosineSearchElement;
  }
  interface HTMLElementEventMap {
    "cosine-results": CustomEvent<CosineResultsDetail>;
    "cosine-select": CustomEvent<CosineSelectDetail>;
  }
}
