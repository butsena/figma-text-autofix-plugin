import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: rootDir,
  publicDir: false,
  appType: "custom",
  test: {
    include: ["src/**/*.test.ts"],
  },
  build: {
    target: "es2017",
    outDir: path.resolve(rootDir, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(rootDir, "src/main.ts"),
      output: {
        entryFileNames: "main.js",
        inlineDynamicImports: true,
        format: "es",
      },
    },
  },
});
