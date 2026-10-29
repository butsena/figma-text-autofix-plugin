import { trackFollowUpAutoFixes } from "../analytics/follow-up-auto";
import type { AnalyticsSpellingSource } from "../analytics/schema";
import { trackManualFixFromDto, trackPluginError } from "../analytics/pipeline-events";
import { isChoicePolicy } from "../core/apply-policy";
import {
  buildAutoApplyReportFromConfirmFix,
  mergeAutoApplyReports,
} from "./build-auto-apply-report";
import { containingFrameName } from "./scan-fix-dto";
import { runAutofixAutoPasses } from "./autofix-pipeline";
import { applyTextFixesToTextNode } from "./apply-fixes";
import {
  readChoiceResolutions,
  recordChoiceResolutionOnNode,
  recordSpellSkipOnNode,
} from "./choice-resolution";
import { classifyManualApplySuccess, hasSavedChoiceDecision, shouldPersistManualResolution } from "./manual-apply-success";
import {
  getLastAutoApplyReport,
  getLastManualApplyReport,
  postCheckResultToUi,
  setLastAutoApplyReport,
  setLastManualApplyReport,
} from "./check-result-session";
import type { TextFixDto } from "../shared/messages";
import { textFixDtoToEngineFix } from "../shared/text-fix-mapping";
import { isOrthographyRuleId } from "../rules/orthography-spell-rules";
import {
  resolveChosenWordRangeAfterApply,
} from "./apply-manual-fix-helpers";

function recordChoiceResolutionAfterApply(node: TextNode, fix: TextFixDto): void {
  const text = node.characters;
  const { from, to } = resolveChosenWordRangeAfterApply(text, fix);

  recordChoiceResolutionOnNode(node, text, {
    ruleId: fix.rule.id,
    from,
    to,
    before: fix.before,
    chosen: fix.after,
  });
}

const inFlightManualOps = new Map<string, Promise<void>>();

/** Одна и та же ручная операция. Другая правка или другой слой — другой ключ. */
export function manualOperationKey(nodeId: string, fix: TextFixDto): string {
  return [nodeId, fix.rule.id, String(fix.from), String(fix.to), fix.before, fix.after].join("\u0000");
}

export function resetManualApplyInFlightForTests(): void {
  inFlightManualOps.clear();
}

export async function applyManualFixAndRefresh(
  nodeId: string,
  fix: TextFixDto,
  spellingSource?: AnalyticsSpellingSource,
): Promise<void> {
  const key = manualOperationKey(nodeId, fix);
  const pending = inFlightManualOps.get(key);
  if (pending) {
    await pending.catch(() => undefined);
    return;
  }

  const run = applyManualFixOnce(nodeId, fix, spellingSource);
  inFlightManualOps.set(key, run);
  try {
    await run;
  } finally {
    if (inFlightManualOps.get(key) === run) inFlightManualOps.delete(key);
  }
}

async function applyManualFixOnce(
  nodeId: string,
  fix: TextFixDto,
  spellingSource?: AnalyticsSpellingSource,
): Promise<void> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || node.type !== "TEXT") {
    trackPluginError("manual_apply", null, { code: "node_missing" });
    return;
  }

  const sourceText = node.characters;
  const textChanges = fix.before !== fix.after;
  const alreadySavedDecision =
    isChoicePolicy(fix.rule.applyPolicy) &&
    !textChanges &&
    hasSavedChoiceDecision(sourceText, readChoiceResolutions(node), fix);

  let applied: Awaited<ReturnType<typeof applyTextFixesToTextNode>> = [];
  applied = textChanges ? await applyTextFixesToTextNode(node, [textFixDtoToEngineFix(fix)], "manual_apply") : [];

  const resolutionSaved = shouldPersistManualResolution(fix, {
    appliedCount: applied.length,
    layerTextBefore: sourceText,
  });
  // Исходная форма (ищите→ищите) сохраняется без замены. Устаревшая замена — нет.
  if (resolutionSaved) {
    recordChoiceResolutionAfterApply(node, fix);
  }

  const success = classifyManualApplySuccess(fix, {
    layerFound: true,
    threw: false,
    layerTextBefore: sourceText,
    appliedCount: applied.length,
    resolutionSaved,
    alreadySavedDecision,
  });
  // Choice уходит в choice_resolved, обычная замена — в manual_fix_complete.
  // Второй счётчик на ту же правку не отправляется.
  if (success.track !== "none") {
    trackManualFixFromDto(fix, "applied", spellingSource);
  }

  if (!textChanges) {
    postCheckResultToUi(figma.currentPage.selection);
    return;
  }

  const selection = figma.currentPage.selection;
  if (applied.length > 0) {
    setLastManualApplyReport(
      mergeAutoApplyReports(
        getLastManualApplyReport(),
        buildAutoApplyReportFromConfirmFix(
          node.id,
          node.name,
          fix,
          sourceText,
          containingFrameName(node),
        ),
      ),
    );
  }

  // После ручной правки добираем auto. В аналитику уходит только дельта этого добора.
  const beforeAutoReport = getLastAutoApplyReport();
  const followUpStartedAt = Date.now();
  let { report, finalScan } = await runAutofixAutoPasses(selection, beforeAutoReport);
  let followUpError: unknown = null;
  try {
    // Автоправки сдвигают текст — перезаписать якоря только уже сохранённого решения.
    if (resolutionSaved) {
      const refreshed = await figma.getNodeByIdAsync(nodeId);
      if (refreshed && refreshed.type === "TEXT") {
        recordChoiceResolutionAfterApply(refreshed, fix);
      }
    }

    const second = await runAutofixAutoPasses(selection, report);
    report = second.report;
    finalScan = second.finalScan;
  } catch (error) {
    followUpError = error;
  }

  setLastAutoApplyReport(report);
  trackFollowUpAutoFixes(
    beforeAutoReport,
    report,
    finalScan.summary.foundFixes,
    Date.now() - followUpStartedAt,
  );
  postCheckResultToUi(selection);
  if (followUpError) throw followUpError;
}

/** «Пропустить» орфографию: макет не меняем, считаем показ (макс. 3 запуска). */
export async function skipManualFixAndRefresh(
  nodeId: string,
  fix: TextFixDto,
): Promise<void> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || node.type !== "TEXT") {
    trackPluginError("manual_apply", null, { code: "node_missing" });
    return;
  }

  if (isOrthographyRuleId(fix.rule.id)) {
    recordSpellSkipOnNode(node, {
      ruleId: fix.rule.id,
      from: fix.from,
      to: fix.to,
      before: fix.before,
    });
  }
  // Пропуск — не исправление: action skipped, не applied.
  trackManualFixFromDto(fix, "skipped");

  postCheckResultToUi(figma.currentPage.selection);
}
