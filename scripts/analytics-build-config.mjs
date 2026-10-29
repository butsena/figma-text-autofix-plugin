export const ANALYTICS_ENDPOINT = "https://script.google.com/macros/s/AKfycbwM7CMlkveKebb88voctDyzNGLn51cVn3ISNNfYdy2LPDDvVSrT0gCvILdctick4xJfgA/exec";
export function resolveAnalyticsBuild(env) {
  if (env.ANALYTICS !== undefined && !["0", "false", "1", "true"].includes(env.ANALYTICS)) throw new Error("Invalid ANALYTICS flag");
  const enabled = env.ANALYTICS === "1" || env.ANALYTICS === "true";
  const mode = env.ANALYTICS_TRAFFIC_MODE;
  const version = env.PLUGIN_VERSION;
  if (enabled && !["test", "production"].includes(mode)) throw new Error("Enabled analytics requires explicit ANALYTICS_TRAFFIC_MODE");
  if (enabled && (typeof version !== "string" || version.length > 32 ||
      !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*)?(?:\+[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*)?$/.test(version))) {
    throw new Error("Enabled analytics requires explicit semver PLUGIN_VERSION (not smoke)");
  }
  return { enabled, trafficMode: enabled ? mode : "test", pluginVersion: enabled ? version : "0.0.0-local", endpoint: ANALYTICS_ENDPOINT };
}
