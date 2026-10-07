/**
 * Конфиг продуктовой аналитики (Google Apps Script Web App).
 * URL виден в бандле — это не секрет. Пустой endpoint = аналитика выключена.
 */
export const ANALYTICS_CONFIG = {
  /** Версия плагина в событиях (не npm package version). */
  pluginVersion: "0.18.0",
  /**
   * Полный URL Web App, заканчивается на /exec.
   * Пустой endpoint = аналитика выключена. URL виден в бандле — это не секрет.
   */
  endpointUrl:
    "https://script.google.com/macros/s/AKfycbwM7CMlkveKebb88voctDyzNGLn51cVn3ISNNfYdy2LPDDvVSrT0gCvILdctick4xJfgA/exec",
  /** Жёсткий выключатель для локальной разработки. */
  enabled: true,
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
