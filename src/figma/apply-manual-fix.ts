import {
  buildAutoApplyReportFromConfirmFix,
  mergeAutoApplyReports,
} from "./build-auto-apply-report";
import { runAutofixAutoPasses } from "./autofix-pipeline";
import { applyTextFixesToTextNode } from "./apply-fixes";
import { recordChoiceResolutionOnNode, recordSpellSkipOnNode } from "./choice-resolution";
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
  isPersistedManualResolution,
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

export async function applyManualFixAndRefresh(
  nodeId: string,
  fix: TextFixDto,
): Promise<void> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || node.type !== "TEXT") return;

  const sourceText = node.characters;
  const persistResolution = isPersistedManualResolution(fix);
  const textChanges = fix.before !== fix.after;

  const applied = textChanges
    ? await applyTextFixesToTextNode(node, [textFixDtoToEngineFix(fix)])
    : [];

  // Даже если выбрана та же форма (ищите→ищите) — записать resolution, иначе choice всплывёт снова.
  if (persistResolution) {
    recordChoiceResolutionAfterApply(node, fix);
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
        buildAutoApplyReportFromConfirmFix(node.id, node.name, fix, sourceText),
      ),
    );
  }

  // После ручной правки (орфография и т.п.) сразу добираем auto: капитализация списка, NBSP…
  let { report } = await runAutofixAutoPasses(selection, getLastAutoApplyReport());

  // Автоправки сдвигают текст — перезаписать якоря resolution, затем ещё один быстрый проход.
  if (persistResolution) {
    const refreshed = await figma.getNodeByIdAsync(nodeId);
    if (refreshed && refreshed.type === "TEXT") {
      recordChoiceResolutionAfterApply(refreshed, fix);
    }
  }

  const second = await runAutofixAutoPasses(selection, report);
  report = second.report;

  setLastAutoApplyReport(report);
  postCheckResultToUi(selection);
}

/** «Пропустить» орфографию: макет не меняем, считаем показ (макс. 3 запуска). */
export async function skipManualFixAndRefresh(
  nodeId: string,
  fix: TextFixDto,
): Promise<void> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || node.type !== "TEXT") return;

  if (isOrthographyRuleId(fix.rule.id)) {
    recordSpellSkipOnNode(node, {
      ruleId: fix.rule.id,
      from: fix.from,
      to: fix.to,
      before: fix.before,
    });
  }

  postCheckResultToUi(figma.currentPage.selection);
}
