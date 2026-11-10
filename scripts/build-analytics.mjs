import fs from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";
import { resolveAnalyticsBuild } from "./analytics-build-config.mjs";
import { verifyAnalyticsBundle } from "./verify-analytics-bundle.mjs";

import { projectBuildVersion } from "./project-build-version.mjs";

const kind = process.argv[2];
if (!["qa", "release"].includes(kind)) throw new Error("Choose qa or release");
const mode = kind === "qa" ? "test" : "production";
if (process.env.ANALYTICS_TRAFFIC_MODE !== undefined && process.env.ANALYTICS_TRAFFIC_MODE !== mode) throw new Error("Build command conflicts with requested traffic mode");
const env = { ...process.env, PLUGIN_VERSION: projectBuildVersion(process.env), ANALYTICS: "1", ANALYTICS_TRAFFIC_MODE: mode, ANALYTICS_BUILD_KIND: kind };
const config = resolveAnalyticsBuild(env);
const run = spawnSync("npm", ["run", "build"], { env, stdio: "inherit" });
if (run.status !== 0) process.exit(run.status ?? 1);
const output = kind === "qa" ? "dist-qa" : "dist-release";
const bytes = await fs.readFile(output + "/main.js");
const proof = await verifyAnalyticsBundle(bytes, config);
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim() !== "";
const manifest = JSON.parse(await fs.readFile("manifest.json", "utf8"));
manifest.main = "main.js";
if (kind === "qa") {
  manifest.name = "Text Autofix — T-151 QA (test)";
}
await fs.writeFile(output + "/manifest.json", JSON.stringify(manifest, null, 2) + "\n");
await fs.writeFile(output + "/build-info.json", JSON.stringify({ ...config, kind, sourceCommit, dirty, ...proof }, null, 2) + "\n");
console.log(JSON.stringify({ output, kind, version: config.pluginVersion, trafficMode: config.trafficMode, ...proof }));
