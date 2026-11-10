import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { resolveAnalyticsBuild } from "./scripts/analytics-build-config.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const analytics = resolveAnalyticsBuild(process.env);
const buildKind = process.env.ANALYTICS_BUILD_KIND;
if (buildKind && (!["qa", "release"].includes(buildKind) || !analytics.enabled ||
    analytics.trafficMode !== (buildKind === "qa" ? "test" : "production"))) throw new Error("Invalid analytics build kind");

export default defineConfig({
  root: rootDir,
  publicDir: false,
  appType: "custom",
  define: {
    __ANALYTICS_ENABLED__: JSON.stringify(analytics.enabled),
    __ANALYTICS_VERSION__: JSON.stringify(analytics.pluginVersion),
    __ANALYTICS_TRAFFIC_MODE__: JSON.stringify(analytics.trafficMode),
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.mjs"],
  },
  build: {
    target: "es2017",
    outDir: path.resolve(rootDir, buildKind === "qa" ? "dist-qa" : buildKind === "release" ? "dist-release" : "dist"),
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
