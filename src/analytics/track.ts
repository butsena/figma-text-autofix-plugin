import { ANALYTICS_CONFIG, isAnalyticsConfigured } from "../config/analytics-config";
import {
  buildAnalyticsEnvelope,
  serializeAnalyticsEnvelope,
  type AnalyticsEventName,
  type AnalyticsPayloadByEvent,
} from "./schema";

export type AnalyticsFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number }>;

let sessionId: string | null = null;

/** Новый session_id на каждый запуск плагина. Без clientStorage. */
export function beginAnalyticsSession(): string {
  sessionId = createSessionId();
  return sessionId;
}

export function getAnalyticsSessionId(): string | null {
  return sessionId;
}

/** Для тестов. */
export function resetAnalyticsSessionForTests(): void {
  sessionId = null;
}

function createSessionId(): string {
  const rand =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? Array.from(crypto.getRandomValues(new Uint8Array(8)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
      : Math.random().toString(16).slice(2) + Date.now().toString(16);
  return `sess_${rand}`.slice(0, 40);
}

/**
 * Fire-and-forget. Не await-ить из продуктового кода.
 * Ошибки сети/таймаута глотаются.
 */
export function trackAnalytics<E extends AnalyticsEventName>(
  event: E,
  payload: AnalyticsPayloadByEvent[E],
  deps: { fetchImpl?: AnalyticsFetch } = {},
): void {
  try {
    if (!isAnalyticsConfigured()) return;
    const sid = sessionId ?? beginAnalyticsSession();
    const built = buildAnalyticsEnvelope({
      event,
      payload,
      sessionId: sid,
      pluginVersion: ANALYTICS_CONFIG.pluginVersion,
    });
    if (!built.ok) return;
    const body = serializeAnalyticsEnvelope(built.envelope);
    if (!body) return;

    const fetchImpl = deps.fetchImpl ?? defaultFetch;
    void postWithTimeout(fetchImpl, ANALYTICS_CONFIG.endpointUrl, body, ANALYTICS_CONFIG.timeoutMs);
  } catch {
    // аналитика никогда не должна ронять плагин
  }
}

async function postWithTimeout(
  fetchImpl: AnalyticsFetch,
  url: string,
  body: string,
  timeoutMs: number,
): Promise<void> {
  try {
    await Promise.race([
      fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("analytics-timeout")), timeoutMs);
      }),
    ]);
  } catch {
    // ignore
  }
}

const defaultFetch: AnalyticsFetch = async (url, init) => {
  const res = await fetch(url, {
    method: init.method,
    headers: init.headers,
    body: init.body,
  });
  return { ok: res.ok, status: res.status };
};
