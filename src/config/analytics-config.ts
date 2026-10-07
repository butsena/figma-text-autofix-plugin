/**
 * Конфиг продуктовой аналитики (Google Apps Script Web App).
 * URL виден в бандле — это не секрет. Пустой endpoint = аналитика выключена.
 *
 * Сборка:
 * - `npm run build` / `dev` — enabled=false (локалка не пишет в прод-таблицу)
 * - `npm run build:release` (ANALYTICS=1) — enabled=true для Community
 */

declare const __ANALYTICS_ENABLED__: boolean;

export const ANALYTICS_CONFIG = {
  /** Версия плагина в событиях (не npm package version). */
  pluginVersion: "0.18.0",
  /**
   * Полный URL Web App, заканчивается на /exec.
   * Пустой endpoint = аналитика выключена. URL виден в бандле — это не секрет.
   */
  endpointUrl:
    "https://script.google.com/macros/s/AKfycbwM7CMlkveKebb88voctDyzNGLn51cVn3ISNNfYdy2LPDDvVSrT0gCvILdctick4xJfgA/exec",
  /**
   * Подставляется на сборке из vite define (__ANALYTICS_ENABLED__).
   * Без ANALYTICS=1 всегда false.
   */
  enabled: typeof __ANALYTICS_ENABLED__ !== "undefined" ? __ANALYTICS_ENABLED__ : false,
  /** Таймаут POST, мс. Продуктовый код не ждёт ответа. */
  timeoutMs: 2500,
} as const;

export function isAnalyticsConfigured(): boolean {
  return (
    ANALYTICS_CONFIG.enabled &&
    typeof ANALYTICS_CONFIG.endpointUrl === "string" &&
    ANALYTICS_CONFIG.endpointUrl.startsWith("https://") &&
    ANALYTICS_CONFIG.endpointUrl.includes("/exec")
  );
}
