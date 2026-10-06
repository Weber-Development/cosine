import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { transformersEmbedder } from "./embedder";
import { buildDirectory, loadIndexFile, readIndex } from "./node";

const HELP = `Usage:
  cosine build <docs-dir> [options]     Build a search index from Markdown, MDX and HTML files
  cosine search <index-dir> <query>     Try a query against a built index

Build options:
  --out <dir>          Output directory (default: public/cosine)
  --base-url <path>    URL prefix of the pages (default: /)
  --model <id>         english (default), multilingual or a Hugging Face model id
  --lexical-only       No embeddings, keyword search only (no model download)
  --exclude <path>     Skip files whose path starts with this (repeatable)
  --max-chars <n>      Soft maximum chunk length (default: 1200)
  --query-prefix <s>   Prefix for queries (custom E5/BGE models)
  --passage-prefix <s> Prefix for passages (custom E5/BGE models)
  --synonyms <file>    JSON file with synonym groups, e.g. [["login", "sign-in"]]
  --incremental        Reuse the vectors of the index in --out, embed only changed sections

Search options:
  --mode <mode>        hybrid (default), lexical or semantic
  --limit <n>          Number of results (default: 5)
`;

/** Accepts `[["a", "b"], ...]`, or `{ "a": ["b", "c"] }` as a shortcut. */
export function parseSynonyms(value: unknown): string[][] {
  const groups = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.entries(value).map(([key, list]) => [key, ...(Array.isArray(list) ? list : [list])])
      : null;
  if (!groups?.every((g) => Array.isArray(g) && g.every((w: unknown) => typeof w === "string"))) {
    throw new Error('expected [["login", "sign-in"], ...] or { "login": ["sign-in"] }');
  }
  return groups as string[][];
}

export async function run(
  argv: string[],
  log: (line: string) => void = console.log,
): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: "string" },
      "base-url": { type: "string" },
      model: { type: "string" },
      "lexical-only": { type: "boolean" },
      exclude: { type: "string", multiple: true },
      "max-chars": { type: "string" },
      "query-prefix": { type: "string" },
      "passage-prefix": { type: "string" },
      synonyms: { type: "string" },
      incremental: { type: "boolean" },
      mode: { type: "string" },
      limit: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  const [command, ...rest] = positionals;

  if (values.help || !command) {
    log(HELP);
    return command || values.help ? 0 : 1;
  }

  if (command === "build") {
    const dir = rest[0];
    if (!dir) {
      log("cosine build: missing <docs-dir>\n");
      log(HELP);
      return 1;
    }
    const out = values.out ?? join("public", "cosine");
    const embedder = values["lexical-only"]
      ? null
      : transformersEmbedder({
          model: values.model ?? "english",
          ...(values["query-prefix"] !== undefined && {
            queryPrefix: values["query-prefix"],
          }),
          ...(values["passage-prefix"] !== undefined && {
            passagePrefix: values["passage-prefix"],
          }),
        });
    let synonyms: string[][] | undefined;
    if (values.synonyms) {
      try {
        synonyms = parseSynonyms(JSON.parse(await readFile(values.synonyms, "utf8")));
      } catch (error) {
        log(`cosine build: cannot read ${values.synonyms}: ${(error as Error).message}`);
        return 1;
      }
    }
    const previous = values.incremental && embedder ? await readIndex(out) : null;
    const started = Date.now();
    const { index, files } = await buildDirectory(dir, out, {
      embedder,
      ...(synonyms && { synonyms }),
      ...(previous && { previous }),
      baseUrl: values["base-url"] ?? "/",
      ...(values.exclude && { exclude: values.exclude }),
      ...(values["max-chars"] && { maxChars: Number(values["max-chars"]) }),
      onProgress: (done, total) => {
        if (process.stderr.isTTY) process.stderr.write(`\rEmbedding ${done}/${total}`);
      },
    });
    if (process.stderr.isTTY && embedder) process.stderr.write("\n");
    const pages = new Set(index.manifest.chunks.map((c) => c.doc)).size;
    const kb = (index.vectors?.byteLength ?? 0) / 1024;
    log(
      `Indexed ${pages} pages as ${index.manifest.chunks.length} chunks in ${((Date.now() - started) / 1000).toFixed(1)} s` +
        (index.manifest.model
          ? ` with ${index.manifest.model} (${kb.toFixed(0)} KB vectors)`
          : " (lexical only)"),
    );
    if (values.incremental && embedder) {
      log(
        previous
          ? `Reused ${index.reused} sections, embedded ${index.embedded}`
          : `No usable index in ${out}, embedded all ${index.embedded} sections`,
      );
    }
    for (const file of files) log(`  ${file}`);
    return 0;
  }

  if (command === "search") {
    const [dir, ...words] = rest;
    const query = words.join(" ");
    if (!dir || !query) {
      log("cosine search: needs <index-dir> and <query>\n");
      return 1;
    }
    const mode = (values.mode ?? "hybrid") as "hybrid" | "lexical" | "semantic";
    const cosine = await loadIndexFile(join(dir, "cosine-index.json"), {
      loadModel: mode === "lexical" ? "never" : "eager",
    });
    await cosine.warmup();
    const results = await cosine.search(query, {
      mode,
      limit: Number(values.limit ?? 5),
    });
    if (!results.length) log("No results.");
    results.forEach((r, i) => {
      log(
        `${i + 1}. ${[r.chunk.title, ...r.chunk.headings].join(" > ")}  (${r.matchedBy.join("+")})`,
      );
      log(`   ${r.chunk.url}`);
      log(`   ${r.snippet}`);
    });
    return 0;
  }

  log(`cosine: unknown command "${command}"\n`);
  log(HELP);
  return 1;
}
