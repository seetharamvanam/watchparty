import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    fileParallelism: false,
    sequence: { concurrent: false },
  },
  // Tests use tsconfig.test.json paths via the alias below; Next's tsconfig excludes tests.
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
