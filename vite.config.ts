import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
  build: {
    target: "es2017",
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "src/main.ts"),
      },
      output: {
        entryFileNames: "main.js",
        inlineDynamicImports: true,
      },
    },
  },
});
