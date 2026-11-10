/**
 * Конфиг продуктовой аналитики (Google Apps Script Web App).
 * URL виден в бандле — это не секрет. Пустой endpoint = аналитика выключена.
 *
 * Сборка:
 * - `npm run build` / `dev` — enabled=false (локалка не пишет в прод-таблицу)
 * - `npm run build:release` — production для Community
 * - `npm run build:qa` — test, отдельная папка
 */

import { ANALYTICS_ENDPOINT } from "../../scripts/analytics-build-config.mjs";

declare const __ANALYTICS_ENABLED__: boolean;
declare const __ANALYTICS_VERSION__: string;
declare const __ANALYTICS_TRAFFIC_MODE__: "production" | "test";

export const ANALYTICS_CONFIG = {
  /** Версия плагина в событиях (не npm package version). */
  pluginVersion: typeof __ANALYTICS_VERSION__ !== "undefined" ? __ANALYTICS_VERSION__ : "0.0.0-local",
  trafficMode: typeof __ANALYTICS_TRAFFIC_MODE__ !== "undefined" ? __ANALYTICS_TRAFFIC_MODE__ : "test",
  /**
   * Полный URL Web App, заканчивается на /exec.
   * Пустой endpoint = аналитика выключена. URL виден в бандле — это не секрет.
   */
  endpointUrl: ANALYTICS_ENDPOINT,
  /**
   * Подставляется на сборке из vite define (__ANALYTICS_ENABLED__).
   * Без ANALYTICS=1 всегда false.
   */
  enabled: typeof __ANALYTICS_ENABLED__ !== "undefined" ? __ANALYTICS_ENABLED__ : false,
  /** Таймаут POST, мс. Продуктовый код не ждёт ответа. */
  timeoutMs: 2500,
} as const;

/** Чистая проверка: аналитика включена и endpoint — https Web App (/exec). */
export function isAnalyticsEndpointReady(enabled: boolean, endpointUrl: string): boolean {
  return (
    enabled &&
    typeof endpointUrl === "string" &&
    endpointUrl.startsWith("https://") &&
    endpointUrl.includes("/exec")
  );
}

export function isAnalyticsConfigured(): boolean {
  return isAnalyticsEndpointReady(ANALYTICS_CONFIG.enabled, ANALYTICS_CONFIG.endpointUrl);
}
