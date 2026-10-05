import type { Chunk, SourceDocument } from "./types";

export interface ChunkOptions {
  /** Soft maximum length of a chunk in characters. Longer sections are split at paragraphs. Default 1200. */
  maxChars?: number;
  /** Smallest heading level that starts a new chunk (2 = `##`). Default 2. */
  minLevel?: number;
  /** Largest heading level that starts a new chunk. Default 4. */
  maxLevel?: number;
  /** Keep fenced code blocks (`keep`, default) or remove them (`drop`). */
  code?: "keep" | "drop";
}

/** GitHub-style heading anchor: `Install with pnpm!` → `install-with-pnpm`. */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  shy: "",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n =
        code[1] === "x" || code[1] === "X"
          ? Number.parseInt(code.slice(2), 16)
          : Number(code.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Reads `title` from YAML front matter and returns the body without it. */
export function parseFrontMatter(source: string): { title?: string; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) return { body: source };
  const title = /^title:\s*(.+)$/m
    .exec(match[1] as string)?.[1]
    ?.trim()
    .replace(/^(["'])(.*)\1$/, "$2");
  return title
    ? { title, body: source.slice(match[0].length) }
    : { body: source.slice(match[0].length) };
}

/** Removes Markdown and MDX syntax from one line of prose. */
function inlineText(line: string): string {
  return decodeEntities(
    line
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links
      .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1") // reference links
      .replace(/<[^>]+>/g, " ") // HTML and JSX tags
      .replace(/`([^`]*)`/g, "$1")
      .replace(/(\*\*|__|\*|_|~~)(?=\S)([^*_~]*?\S)\1/g, "$2")
      .replace(/^\s{0,3}>\s?/, "") // block quotes
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "") // list markers
      .replace(/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/, "") // table separators
      .replace(/\s*\|\s*/g, " | ")
      .replace(/^\s*\|\s*|\s*\|\s*$/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

interface Section {
  headings: string[];
  anchor?: string;
  lines: string[];
}

/**
 * Splits a Markdown or MDX page into chunks along its headings. The first `#` heading (or the
 * `title` front matter) becomes the page title.
 */
export function chunkMarkdown(
  doc: SourceDocument,
  options: ChunkOptions = {},
  startId = 0,
): Chunk[] {
  const { maxChars = 1200, minLevel = 2, maxLevel = 4, code = "keep" } = options;
  const fm = parseFrontMatter(doc.content);
  let title = fm.title ?? doc.title;
  const lines = fm.body.split(/\r?\n/);
  const sections: Section[] = [{ headings: [], lines: [] }];
  const stack: string[] = [];
  const used = new Map<string, number>();
  let fence: string | null = null;
  let titleFromHeading = !fm.title;

  for (const raw of lines) {
    const fenceMatch = /^\s*(```|~~~)/.exec(raw);
    if (fence) {
      if (fenceMatch && fenceMatch[1] === fence) fence = null;
      else if (code === "keep") (sections.at(-1) as Section).lines.push(raw.trim());
      continue;
    }
    if (fenceMatch) {
      fence = fenceMatch[1] as string;
      continue;
    }
    // MDX module lines carry no content.
    if (/^\s*(import|export)\s.+(from\s|=)/.test(raw)) continue;

    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(raw);
    if (heading) {
      const level = (heading[1] as string).length;
      let text = heading[2] as string;
      let anchor: string | undefined;
      const custom = /\s*\{#([^}]+)\}$/.exec(text);
      if (custom) {
        anchor = custom[1];
        text = text.slice(0, custom.index);
      }
      text = inlineText(text);
      if (level === 1 && titleFromHeading) {
        title = text;
        titleFromHeading = false;
        continue;
      }
      if (level >= minLevel && level <= maxLevel) {
        stack.length = Math.max(0, level - minLevel);
        stack.push(text);
        if (!anchor) {
          const base = slugify(text);
          const n = used.get(base) ?? 0;
          used.set(base, n + 1);
          anchor = n ? `${base}-${n}` : base;
        }
        sections.push({ headings: [...stack], anchor, lines: [] });
        continue;
      }
      (sections.at(-1) as Section).lines.push(text);
      continue;
    }
    (sections.at(-1) as Section).lines.push(inlineText(raw));
  }

  const chunks: Chunk[] = [];
  for (const section of sections) {
    const url = section.anchor ? `${doc.url}#${section.anchor}` : doc.url;
    for (const text of splitParagraphs(section.lines, maxChars)) {
      chunks.push({
        id: startId + chunks.length,
        doc: doc.id,
        url,
        title,
        headings: section.headings,
        text,
      });
    }
  }
  return chunks;
}

/** Joins lines into paragraphs and packs them into pieces of at most about `maxChars`. */
function splitParagraphs(lines: string[], maxChars: number): string[] {
  const paragraphs: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line) current.push(line);
    else if (current.length) {
      paragraphs.push(current.join(" "));
      current = [];
    }
  }
  if (current.length) paragraphs.push(current.join(" "));

  const pieces: string[] = [];
  let piece = "";
  const flush = () => {
    if (piece.trim()) pieces.push(piece.trim());
    piece = "";
  };
  for (const paragraph of paragraphs) {
    if (piece && piece.length + paragraph.length + 1 > maxChars) flush();
    if (paragraph.length > maxChars) {
      // One very long paragraph: cut at sentence ends.
      for (const sentence of paragraph.match(/[^.!?]+(?:[.!?]+\s*|$)/g) ?? [paragraph]) {
        if (piece && piece.length + sentence.length > maxChars) flush();
        piece += sentence;
      }
      continue;
    }
    piece = piece ? `${piece}\n${paragraph}` : paragraph;
  }
  flush();
  return pieces;
}

/**
 * Turns a built HTML page into Markdown-like text that `chunkMarkdown` understands. Reads
 * `<main>` (or `<article>`, or `<body>`), drops navigation, scripts and styles, and keeps the `id`
 * of headings as anchors.
 */
export function htmlToMarkdown(html: string): { title?: string; markdown: string } {
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  let body =
    /<main[\s>][\s\S]*?<\/main>/i.exec(html)?.[0] ??
    /<article[\s>][\s\S]*?<\/article>/i.exec(html)?.[0] ??
    /<body[\s>][\s\S]*?<\/body>/i.exec(html)?.[0] ??
    html;
  body = body
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<(script|style|noscript|template|svg|nav|header|footer|aside|form|button)[\s>][\s\S]*?<\/\1>/gi,
      "",
    )
    .replace(/<[^>]+data-cosine-ignore[^>]*>[\s\S]*?<\/[^>]+>/gi, "");
  const markdown = body
    .replace(
      /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi,
      (_m, level: string, attrs: string, inner: string) => {
        const id = /\sid=["']([^"']+)["']/i.exec(attrs)?.[1];
        const text = decodeEntities(inner.replace(/<[^>]+>/g, ""))
          .replace(/\s+/g, " ")
          .trim();
        return `\n\n${"#".repeat(Number(level))} ${text}${id ? ` {#${id}}` : ""}\n\n`;
      },
    )
    .replace(/<pre[\s>][\s\S]*?<\/pre>/gi, (block) => `\n\n${block.replace(/<[^>]+>/g, "")}\n\n`)
    .replace(/<\/(p|div|section|li|tr|table|ul|ol|blockquote|dd|dt|figure)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  const title = titleTag ? decodeEntities(titleTag).replace(/\s+/g, " ").trim() : undefined;
  return title ? { title, markdown } : { markdown };
}
