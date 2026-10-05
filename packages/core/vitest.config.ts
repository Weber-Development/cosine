import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 30_000,
    // The real-model test downloads a model; it only runs when COSINE_E2E=1 (in CI).
    hookTimeout: 300_000,
  },
});
