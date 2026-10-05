import type { Embedder } from "../src/types";

// Words with the same meaning share a dimension, so the toy model "understands" synonyms.
const GROUPS = [
  ["remove", "delete", "uninstall", "erase", "loschen", "entfernen"],
  ["install", "setup", "installation"],
  ["price", "cost", "plan", "subscription", "pay", "billing", "invoice", "invoices", "kosten"],
  ["colleague", "colleagues", "team", "member", "members", "invite", "coworker"],
  ["file", "files", "folder", "document"],
  ["role", "roles", "permission", "permissions", "admin", "admins", "rights"],
];

/** Deterministic toy embedder for tests: bag of synonym groups plus hashed other words. */
export function toyEmbedder(model = "toy-model"): Embedder & { calls: number } {
  const dims = GROUPS.length + 16;
  const embedder = {
    model,
    dimensions: dims,
    calls: 0,
    async embed(texts: string[]) {
      embedder.calls++;
      return texts.map((text) => {
        const v = new Float32Array(dims);
        for (const word of text
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{M}/gu, "")
          .match(/\p{L}+/gu) ?? []) {
          const g = GROUPS.findIndex((group) => group.includes(word));
          if (g >= 0) v[g] = (v[g] as number) + 3;
          else {
            let h = 0;
            for (const c of word) h = (h * 31 + (c.codePointAt(0) as number)) >>> 0;
            const i = GROUPS.length + (h % 16);
            v[i] = (v[i] as number) + 0.2;
          }
        }
        return v;
      });
    },
  };
  return embedder;
}
