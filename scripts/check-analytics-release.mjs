import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveAnalyticsBuild } from "./analytics-build-config.mjs";
import { verifyAnalyticsBundle } from "./verify-analytics-bundle.mjs";

export function assertReleaseMetadata(info, expectedVersion, currentCommit) {
  if (info.kind !== "release" || !info.enabled || info.trafficMode !== "production" ||
      info.pluginVersion !== expectedVersion || info.dirty !== false || info.sourceCommit !== currentCommit) throw new Error("Not a clean release artifact for the requested version/commit");
}
export function assertRolloutReady(health, report) {
  if (health.collector_revision !== "T-151-1" || health.traffic_mode_storage !== "events!H" ||
      JSON.stringify(health.traffic_modes) !== JSON.stringify(["production", "test"])) throw new Error("Working receiver does not support traffic modes");
  if (report?.spreadsheetId !== "1hp5YccbllfFn0cYRkvp6ClWEXbx5Es1R79FFLsqfHqM" ||
      report.revision !== "T-151-1" || report.testsExcluded !== true || report.formulaErrors !== 0 ||
      !Number.isFinite(Date.parse(report.verifiedAt))) throw new Error("Working report verification is missing; a preview copy is not sufficient");
}
async function main() {
  const expected = resolveAnalyticsBuild({ ANALYTICS: "1", ANALYTICS_TRAFFIC_MODE: "production", PLUGIN_VERSION: process.env.PLUGIN_VERSION });
  const info = JSON.parse(await fs.readFile("dist-release/build-info.json", "utf8"));
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  assertReleaseMetadata(info, expected.pluginVersion, commit);
  const manifest = JSON.parse(await fs.readFile("dist-release/manifest.json", "utf8"));
  const sourceManifest = JSON.parse(await fs.readFile("manifest.json", "utf8"));
  if (manifest.id !== sourceManifest.id || manifest.name !== sourceManifest.name || manifest.main !== "main.js") throw new Error("QA or wrong manifest cannot be published");
  const verified = await verifyAnalyticsBundle(await fs.readFile("dist-release/main.js"), expected);
  if (verified.sha256 !== info.sha256) throw new Error("Release file changed after build");
  if (!process.env.ANALYTICS_REPORT_PROOF) throw new Error("Set ANALYTICS_REPORT_PROOF to the approved working report verification file");
  const report = JSON.parse(await fs.readFile(process.env.ANALYTICS_REPORT_PROOF, "utf8"));
  const response = await fetch(expected.endpoint, { signal: AbortSignal.timeout(10000) }); // GET only
  if (!response.ok) throw new Error("Receiver health check failed");
  assertRolloutReady(await response.json(), report);
  console.log(JSON.stringify({ releaseChecked: true, commit, version: expected.pluginVersion, ...verified, published: false }));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
