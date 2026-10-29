import { isChoicePolicy } from "../core/apply-policy";
import { isOrthographyRuleId } from "../rules/orthography-spell-rules";
import type { AutoApplyReportDto, CheckSummary, TextFixDto } from "../shared/messages";
import { normalizeSpellingSource } from "../shared/spelling-source";
import {
  aggregateAnalyticsCategories,
  type AnalyticsErrorCode,
  type AnalyticsErrorStage,
  type AnalyticsSpellingSource,
} from "./schema";
import { trackAnalytics } from "./track";
import { createAnalyticsEventId } from "./event-id";
import { AnalyticsFailure } from "./failure";
import type { PluginErrorPayload } from "./schema";

/** Кнопка «Проверить орфографию»: один клик, без текста слоёв. */
export function trackSpellcheckRequested(): void {
  trackAnalytics("spellcheck_requested", {});
}

export function trackPluginOpen(hasTextLayers: boolean): void {
  trackAnalytics("plugin_open", { has_text_layers: hasTextLayers });
}

export function trackScanComplete(summary: CheckSummary, durationMs: number): void {
  trackAnalytics("scan_complete", {
    checked_layers: summary.checkedLayers,
    found_fixes: summary.foundFixes,
    confirm_fixes: summary.confirmFixes,
    choice_fixes: summary.choiceFixes,
    duration_ms: durationMs,
  });
}

export function trackAutoFixComplete(
  report: AutoApplyReportDto,
  remainingAutoFixes: number,
  durationMs: number,
): void {
  const applied = report.summary.appliedFixCount;
  trackAnalytics("auto_fix_complete", {
    found: applied + remainingAutoFixes,
    applied,
    not_applied: remainingAutoFixes,
    duration_ms: durationMs,
    categories: aggregateAnalyticsCategories(
      report.layers.flatMap((layer) => layer.fixes.map((fix) => fix.category)),
    ),
  });
}

/**
 * `applied` вызывать только после подтверждённого результата.
 * Choice становится `choice_resolved`, а не вторым `manual_fix_complete`.
 */
export function trackManualFixFromDto(
  fix: TextFixDto,
  action: "applied" | "skipped",
  spellingSource?: AnalyticsSpellingSource,
): void {
  if (isChoicePolicy(fix.rule.applyPolicy)) {
    trackAnalytics("choice_resolved", {
      action: action === "applied" ? "confirmed" : "skipped",
    });
    return;
  }
  const kind = isOrthographyRuleId(fix.rule.id) ? "orthography" : "confirm";
  if (kind === "orthography" && action === "applied") {
    trackAnalytics("manual_fix_complete", {
      action,
      kind,
      source: normalizeSpellingSource(spellingSource),
      event_id: createAnalyticsEventId(),
    });
    return;
  }
  trackAnalytics("manual_fix_complete", { action, kind });
}

export function mapErrorToAnalyticsCode(error: unknown): AnalyticsErrorCode {
  if (!(error instanceof Error)) return "unknown";
  if (typeof error.message !== "string") return "unknown";
  const msg = error.message.toLowerCase();
  if (msg.includes("font")) return "font_load_failed";
  if (msg.includes("timeout")) return "timeout";
  if (msg.includes("node")) return "node_missing";
  if (msg.includes("lexicon")) return "lexicon_load_failed";
  if (msg.includes("spell") || msg.includes("hunspell")) return "spell_load_failed";
  if (msg.includes("apply")) return "apply_failed";
  return "unknown";
}

export function trackPluginError(
  stage: AnalyticsErrorStage,
  error: unknown,
  details: Partial<Pick<PluginErrorPayload, "outcome" | "resource" | "recovery" | "code">> = {},
): void {
  try {
    trackAnalytics("plugin_error", {
      stage: error instanceof AnalyticsFailure ? error.stage : stage,
      code: error instanceof AnalyticsFailure ? error.code : details.code ?? mapErrorToAnalyticsCode(error),
      outcome: details.outcome ?? "failed",
      ...(details.resource ? { resource: details.resource } : {}),
      ...(details.recovery ? { recovery: details.recovery } : {}),
    });
  } catch {
    // Diagnostic access/transport must not change the product operation or its error.
  }
}
