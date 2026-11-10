export const ANALYTICS_ENDPOINT: string;
export function resolveAnalyticsBuild(env: Record<string, string | undefined>): {
  enabled: boolean; trafficMode: "test" | "production"; pluginVersion: string; endpoint: string;
};
