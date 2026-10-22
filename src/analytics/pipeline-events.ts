import { isChoicePolicy } from "../core/apply-policy";
import { isOrthographyRuleId } from "../rules/orthography-spell-rules";
import type { AutoApplyReportDto, CheckSummary, TextFixDto } from "../shared/messages";
import {
  aggregateAnalyticsCategories,
  type AnalyticsErrorCode,
  type AnalyticsErrorStage,
} from "./schema";
import { trackAnalytics } from "./track";

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

export function trackManualFixFromDto(fix: TextFixDto, action: "applied" | "skipped"): void {
  if (isChoicePolicy(fix.rule.applyPolicy)) {
    trackAnalytics("choice_resolved", {
      action: action === "applied" ? "confirmed" : "skipped",
    });
    return;
  }
  trackAnalytics("manual_fix_complete", {
    action,
    kind: isOrthographyRuleId(fix.rule.id) ? "orthography" : "confirm",
  });
}

export function mapErrorToAnalyticsCode(error: unknown): AnalyticsErrorCode {
  if (!(error instanceof Error)) return "unknown";
  const msg = error.message.toLowerCase();
  if (msg.includes("font")) return "font_load_failed";
  if (msg.includes("timeout")) return "timeout";
  if (msg.includes("node")) return "node_missing";
  if (msg.includes("lexicon")) return "lexicon_load_failed";
  if (msg.includes("spell") || msg.includes("hunspell")) return "spell_load_failed";
  if (msg.includes("apply")) return "apply_failed";
  return "unknown";
}

export function trackPluginError(stage: AnalyticsErrorStage, error: unknown): void {
  trackAnalytics("plugin_error", {
    stage,
    code: mapErrorToAnalyticsCode(error),
  });
}
