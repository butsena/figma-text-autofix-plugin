/**
 * Schema v1 продуктовой аналитики.
 * Только числа, enum и короткие id. Без текста слоёв, имён, file/user id, stack.
 */

export const ANALYTICS_SCHEMA_VERSION = 1 as const;

export const ANALYTICS_EVENT_NAMES = [
  "plugin_open",
  "scan_complete",
  "auto_fix_complete",
  "manual_fix_complete",
  "choice_resolved",
  "spellcheck_requested",
  "plugin_error",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

/** Категории правок для агрегатов — закрытый список + other. */
export const ANALYTICS_FIX_CATEGORIES = [
  "cian_branding",
  "cian_declension_context",
  "cian_editorial",
  "form_choice",
  "numeric_formatting",
  "phone_formatting",
  "punctuation_typography",
  "sheet_text",
  "text_formatting",
  "typography",
  "yo_spelling",
  "orthography",
  "other",
] as const;

export type AnalyticsFixCategory = (typeof ANALYTICS_FIX_CATEGORIES)[number];

export const ANALYTICS_ERROR_STAGES = [
  "open",
  "scan",
  "auto_apply",
  "manual_apply",
  "choice",
  "lexicon",
  "spell",
  "ui",
  "unknown",
] as const;

export type AnalyticsErrorStage = (typeof ANALYTICS_ERROR_STAGES)[number];

/** Безопасные коды — не message и не stack. */
export const ANALYTICS_ERROR_CODES = [
  "empty_selection",
  "font_load_failed",
  "node_missing",
  "apply_failed",
  "lexicon_load_failed",
  "spell_load_failed",
  "timeout",
  "unknown",
] as const;

export type AnalyticsErrorCode = (typeof ANALYTICS_ERROR_CODES)[number];

export type PluginOpenPayload = {
  /** Было ли выделение с текстовыми слоями на открытии. */
  has_text_layers: boolean;
};

export type ScanCompletePayload = {
  checked_layers: number;
  found_fixes: number;
  confirm_fixes: number;
  choice_fixes: number;
  duration_ms: number;
};

export type AutoFixCompletePayload = {
  found: number;
  applied: number;
  not_applied: number;
  duration_ms: number;
  /** Сколько применённых auto-правок по категориям. */
  categories: Partial<Record<AnalyticsFixCategory, number>>;
};

export type ManualFixCompletePayload = {
  /**
   * applied — текст уже изменён этой правкой.
   * skipped — человек пропустил карточку; это не исправление.
   * Клик «Исправить» без изменения текста applied не создаёт.
   * Записи до 2026-10-23 (Community v22 и раньше) так не различали и не пересчитываются.
   */
  action: "applied" | "skipped";
  /** confirm = «Обратите внимание»; orthography = поле «как исправить». */
  kind: "confirm" | "orthography";
};

export type ChoiceResolvedPayload = {
  /**
   * confirmed — решение о форме сохранено, в том числе когда выбрана исходная форма и текст не менялся.
   * Это не изменение текста и не ошибка. skipped — пропуск, не исправление.
   * Старые confirmed до 2026-10-23 остаются попытками и не переписываются.
   */
  action: "confirmed" | "skipped";
};

/** Клик «Проверить орфографию». Пустой payload: это сам факт нажатия. */
export type SpellcheckRequestedPayload = Record<string, never>;

export type PluginErrorPayload = {
  stage: AnalyticsErrorStage;
  code: AnalyticsErrorCode;
};

export type AnalyticsPayloadByEvent = {
  plugin_open: PluginOpenPayload;
  scan_complete: ScanCompletePayload;
  auto_fix_complete: AutoFixCompletePayload;
  manual_fix_complete: ManualFixCompletePayload;
  choice_resolved: ChoiceResolvedPayload;
  spellcheck_requested: SpellcheckRequestedPayload;
  plugin_error: PluginErrorPayload;
};

export type AnalyticsEnvelope<E extends AnalyticsEventName = AnalyticsEventName> = {
  schema_version: typeof ANALYTICS_SCHEMA_VERSION;
  client_time: string;
  session_id: string;
  plugin_version: string;
  event: E;
  payload: AnalyticsPayloadByEvent[E];
};

const EVENT_NAME_SET = new Set<string>(ANALYTICS_EVENT_NAMES);
const CATEGORY_SET = new Set<string>(ANALYTICS_FIX_CATEGORIES);
const STAGE_SET = new Set<string>(ANALYTICS_ERROR_STAGES);
const CODE_SET = new Set<string>(ANALYTICS_ERROR_CODES);

/** Поля, которые никогда не должны оказаться в сериализованном событии. */
export const ANALYTICS_FORBIDDEN_KEYS = [
  "before",
  "after",
  "sourceText",
  "originalText",
  "previewText",
  "characters",
  "nodeName",
  "nodeId",
  "fileKey",
  "fileName",
  "pageId",
  "userId",
  "email",
  "message",
  "stack",
  "hint",
  "hintHtml",
  "error",
] as const;

export function isAnalyticsEventName(value: string): value is AnalyticsEventName {
  return EVENT_NAME_SET.has(value);
}

export function mapRuleCategoryToAnalytics(category: string): AnalyticsFixCategory {
  if (CATEGORY_SET.has(category)) return category as AnalyticsFixCategory;
  return "other";
}

export function aggregateAnalyticsCategories(
  categories: Iterable<string>,
): Partial<Record<AnalyticsFixCategory, number>> {
  const out: Partial<Record<AnalyticsFixCategory, number>> = {};
  for (const raw of categories) {
    const key = mapRuleCategoryToAnalytics(raw);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function isFiniteNonNegInt(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && Math.floor(value) === value;
}

function assertNoForbiddenKeys(value: unknown, path: string, errors: string[]): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoForbiddenKeys(item, `${path}[${i}]`, errors));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((ANALYTICS_FORBIDDEN_KEYS as readonly string[]).includes(key)) {
      errors.push(`${path}.${key}`);
    }
    assertNoForbiddenKeys(child, `${path}.${key}`, errors);
  }
}

function validatePayload(event: AnalyticsEventName, payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "payload must be object";
  }
  const p = payload as Record<string, unknown>;

  switch (event) {
    case "plugin_open":
      if (typeof p.has_text_layers !== "boolean") return "has_text_layers";
      return null;
    case "scan_complete":
      for (const key of ["checked_layers", "found_fixes", "confirm_fixes", "choice_fixes", "duration_ms"]) {
        if (!isFiniteNonNegInt(p[key])) return key;
      }
      return null;
    case "auto_fix_complete":
      for (const key of ["found", "applied", "not_applied", "duration_ms"]) {
        if (!isFiniteNonNegInt(p[key])) return key;
      }
      if (!p.categories || typeof p.categories !== "object" || Array.isArray(p.categories)) {
        return "categories";
      }
      for (const [cat, n] of Object.entries(p.categories as Record<string, unknown>)) {
        if (!CATEGORY_SET.has(cat) || !isFiniteNonNegInt(n)) return `categories.${cat}`;
      }
      return null;
    case "manual_fix_complete":
      if (p.action !== "applied" && p.action !== "skipped") return "action";
      if (p.kind !== "confirm" && p.kind !== "orthography") return "kind";
      return null;
    case "choice_resolved":
      if (p.action !== "confirmed" && p.action !== "skipped") return "action";
      return null;
    case "spellcheck_requested":
      return null;
    case "plugin_error":
      if (typeof p.stage !== "string" || !STAGE_SET.has(p.stage)) return "stage";
      if (typeof p.code !== "string" || !CODE_SET.has(p.code)) return "code";
      return null;
  }
}

/**
 * Собирает envelope и проверяет контракт.
 * Лишние ключи в payload не копируются — только известные поля события.
 */
export function buildAnalyticsEnvelope<E extends AnalyticsEventName>(input: {
  event: E;
  payload: AnalyticsPayloadByEvent[E];
  sessionId: string;
  pluginVersion: string;
  clientTime?: string;
}): { ok: true; envelope: AnalyticsEnvelope<E> } | { ok: false; reason: string } {
  const sessionId = input.sessionId.trim();
  if (sessionId.length < 8 || sessionId.length > 64) {
    return { ok: false, reason: "session_id length" };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(sessionId)) {
    return { ok: false, reason: "session_id charset" };
  }
  const pluginVersion = input.pluginVersion.trim();
  if (!pluginVersion || pluginVersion.length > 32) {
    return { ok: false, reason: "plugin_version" };
  }

  const payloadError = validatePayload(input.event, input.payload);
  if (payloadError) return { ok: false, reason: `payload.${payloadError}` };

  const envelope = {
    schema_version: ANALYTICS_SCHEMA_VERSION,
    client_time: input.clientTime ?? new Date().toISOString(),
    session_id: sessionId,
    plugin_version: pluginVersion,
    event: input.event,
    payload: sanitizePayload(input.event, input.payload),
  } as AnalyticsEnvelope<E>;

  const forbidden: string[] = [];
  assertNoForbiddenKeys(envelope, "envelope", forbidden);
  if (forbidden.length) {
    return { ok: false, reason: `forbidden:${forbidden.join(",")}` };
  }

  return { ok: true, envelope };
}

function sanitizePayload<E extends AnalyticsEventName>(
  event: E,
  payload: AnalyticsPayloadByEvent[E],
): AnalyticsPayloadByEvent[E] {
  switch (event) {
    case "plugin_open": {
      const p = payload as PluginOpenPayload;
      return { has_text_layers: !!p.has_text_layers } as AnalyticsPayloadByEvent[E];
    }
    case "scan_complete": {
      const p = payload as ScanCompletePayload;
      return {
        checked_layers: p.checked_layers,
        found_fixes: p.found_fixes,
        confirm_fixes: p.confirm_fixes,
        choice_fixes: p.choice_fixes,
        duration_ms: p.duration_ms,
      } as AnalyticsPayloadByEvent[E];
    }
    case "auto_fix_complete": {
      const p = payload as AutoFixCompletePayload;
      const categories: Partial<Record<AnalyticsFixCategory, number>> = {};
      for (const [cat, n] of Object.entries(p.categories ?? {})) {
        if (CATEGORY_SET.has(cat) && isFiniteNonNegInt(n) && n > 0) {
          categories[cat as AnalyticsFixCategory] = n;
        }
      }
      return {
        found: p.found,
        applied: p.applied,
        not_applied: p.not_applied,
        duration_ms: p.duration_ms,
        categories,
      } as AnalyticsPayloadByEvent[E];
    }
    case "manual_fix_complete": {
      const p = payload as ManualFixCompletePayload;
      return { action: p.action, kind: p.kind } as AnalyticsPayloadByEvent[E];
    }
    case "choice_resolved": {
      const p = payload as ChoiceResolvedPayload;
      return { action: p.action } as AnalyticsPayloadByEvent[E];
    }
    case "spellcheck_requested":
      return {} as AnalyticsPayloadByEvent[E];
    case "plugin_error": {
      const p = payload as PluginErrorPayload;
      return { stage: p.stage, code: p.code } as AnalyticsPayloadByEvent[E];
    }
  }
}

/** JSON для POST. null — событие отбрасываем (битый контракт). */
export function serializeAnalyticsEnvelope(envelope: AnalyticsEnvelope): string | null {
  const built = buildAnalyticsEnvelope({
    event: envelope.event,
    payload: envelope.payload,
    sessionId: envelope.session_id,
    pluginVersion: envelope.plugin_version,
    clientTime: envelope.client_time,
  });
  if (!built.ok) return null;
  return JSON.stringify(built.envelope);
}
