// Serves the built web component and two small lexical indexes for the browser tests.
import { mkdtemp, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { buildIndex, writeIndex } from "@sweberdev/cosine/node";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "../core/dist");
const port = Number(process.env.PORT ?? 4173);

const docs = [
  {
    id: "billing",
    url: "/docs/billing",
    title: "Billing",
    content:
      "## Invoices\n\nInvoices arrive on the first day of each month.\n\n## Plans\n\nChange your plan at any time.",
  },
  {
    id: "install",
    url: "/docs/install",
    title: "Install",
    content: "Run npm install to add the package. Sign in with your account to continue.",
  },
  {
    id: "webhooks",
    url: "/docs/webhooks",
    title: "Webhooks",
    content: "Webhooks notify your server. Failed deliveries are retried for a day.",
  },
];
const blog = [
  {
    id: "news",
    url: "/blog/news",
    title: "Invoices news",
    content: "## Invoices\n\nA new invoices layout is available.",
  },
];

const out = await mkdtemp(join(tmpdir(), "cosine-e2e-"));
await writeIndex(await buildIndex(docs), join(out, "docs"));
await writeIndex(await buildIndex(blog), join(out, "blog"));

const types = {
  ".js": "text/javascript",
  ".json": "application/json",
  ".html": "text/html; charset=utf-8",
  ".bin": "application/octet-stream",
};

async function file(path) {
  return readFile(path);
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  try {
    let body;
    if (path.startsWith("/dist/")) body = await file(join(dist, path.slice(6)));
    else if (path.startsWith("/index/")) body = await file(join(out, path.slice(7)));
    else if (path === "/") body = await file(join(here, "page.html"));
    else {
      res.writeHead(404).end("not found");
      return;
    }
    res
      .writeHead(200, {
        "content-type": types[extname(path === "/" ? "/page.html" : path)] ?? "text/plain",
      })
      .end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(port, () => console.log(`e2e server on ${port}`));
