import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    node: "src/node.ts",
    bin: "src/bin.ts",
    "element-define": "src/element-define.ts",
    docusaurus: "src/integrations/docusaurus.ts",
    astro: "src/integrations/astro.ts",
    vitepress: "src/integrations/vitepress.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2021",
  external: ["@huggingface/transformers"],
});
