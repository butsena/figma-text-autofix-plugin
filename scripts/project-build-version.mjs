import { readFileSync } from "node:fs";
import { resolveAnalyticsBuild } from "./analytics-build-config.mjs";

// One checked-in version for QA, release and release verification.
// Explicit overrides remain available for separately identified candidates.
export function projectBuildVersion(env, project = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))) {
  const version = env.PLUGIN_VERSION === undefined ? project.version : env.PLUGIN_VERSION;
  return resolveAnalyticsBuild({ ANALYTICS: "1", ANALYTICS_TRAFFIC_MODE: "production", PLUGIN_VERSION: version }).pluginVersion;
}
