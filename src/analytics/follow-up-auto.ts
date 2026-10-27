import type { AutoApplyReportDto } from "../shared/messages";
import { aggregateAnalyticsCategories, type AutoFixCompletePayload } from "./schema";
import { trackAnalytics } from "./track";

type ReportFix = AutoApplyReportDto["layers"][number]["fixes"][number];

/**
 * Новые auto после ручного действия — это дельта отчёта, а не весь накопленный UI-отчёт.
 * Нулевая дельта не создаёт событие: прежние применения и категории не отправляются снова.
 * duration_ms — только часы этого добора, не время человека и не модельная оценка.
 */
export function followUpAutoFixPayload(
  before: AutoApplyReportDto | null,
  after: AutoApplyReportDto,
  remainingAutoFixes: number,
  durationMs: number,
): AutoFixCompletePayload | null {
  const appliedFixes = newAutoFixes(before, after);
  if (appliedFixes.length === 0) return null;

  const applied = appliedFixes.length;
  const notApplied = nonNegativeInt(remainingAutoFixes);
  return {
    found: applied + notApplied,
    applied,
    not_applied: notApplied,
    duration_ms: nonNegativeInt(durationMs),
    categories: aggregateAnalyticsCategories(appliedFixes.map((fix) => fix.category)),
  };
}

export function trackFollowUpAutoFixes(
  before: AutoApplyReportDto | null,
  after: AutoApplyReportDto,
  remainingAutoFixes: number,
  durationMs: number,
): void {
  const payload = followUpAutoFixPayload(before, after, remainingAutoFixes, durationMs);
  if (!payload) return;
  trackAnalytics("auto_fix_complete", payload);
}

function newAutoFixes(
  before: AutoApplyReportDto | null,
  after: AutoApplyReportDto,
): ReportFix[] {
  const alreadyCounted = new Map<string, number>();
  for (const fix of fixesOf(before)) {
    alreadyCounted.set(fix.fixId, (alreadyCounted.get(fix.fixId) ?? 0) + 1);
  }

  const fresh: ReportFix[] = [];
  for (const fix of fixesOf(after)) {
    const left = alreadyCounted.get(fix.fixId) ?? 0;
    if (left > 0) {
      alreadyCounted.set(fix.fixId, left - 1);
      continue;
    }
    fresh.push(fix);
  }
  return fresh;
}

function fixesOf(report: AutoApplyReportDto | null): ReportFix[] {
  if (!report) return [];
  return report.layers.flatMap((layer) => layer.fixes);
}

function nonNegativeInt(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}
