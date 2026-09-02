import {
  buildAutoApplyReportFromConfirmFix,
  mergeAutoApplyReports,
} from "./build-auto-apply-report";
import { runAutofixAutoPasses } from "./autofix-pipeline";
import { applyTextFixesToTextNode } from "./apply-fixes";
import {
  findChosenWordNear,
  recordChoiceResolutionOnNode,
} from "./choice-resolution";
import {
  getLastAutoApplyReport,
  postCheckResultToUi,
  setLastAutoApplyReport,
} from "./check-result-session";
import type { TextFixDto } from "../shared/messages";
import { textFixDtoToEngineFix } from "../shared/text-fix-mapping";
import { isChoicePolicy } from "../core/apply-policy";

function recordChoiceResolutionAfterApply(node: TextNode, fix: TextFixDto): void {
  const text = node.characters;
  const chosen = fix.after;
  let from = fix.from;
  let to = fix.from + chosen.length;

  const wordAtExpected = text.slice(from, to);
  if (wordAtExpected !== chosen) {
    const found = findChosenWordNear(text, chosen, fix.from);
    if (found != null) {
      from = found;
      to = found + chosen.length;
    }
  }

  recordChoiceResolutionOnNode(node, text, {
    ruleId: fix.rule.id,
    from,
    to,
    before: fix.before,
    chosen,
  });
}

export async function applyManualFixAndRefresh(
  nodeId: string,
  fix: TextFixDto,
): Promise<void> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || node.type !== "TEXT") return;

  const sourceText = node.characters;

  const applied =
    fix.before !== fix.after
      ? await applyTextFixesToTextNode(node, [textFixDtoToEngineFix(fix)])
      : [];

  if (isChoicePolicy(fix.rule.applyPolicy)) {
    recordChoiceResolutionAfterApply(node, fix);
  }

  const selection = figma.currentPage.selection;
  let reportBase = getLastAutoApplyReport();
  if (applied.length > 0) {
    reportBase = mergeAutoApplyReports(
      reportBase,
      buildAutoApplyReportFromConfirmFix(node.id, node.name, fix, sourceText),
    );
  }

  const { report, finalScan } = await runAutofixAutoPasses(selection, reportBase);
  setLastAutoApplyReport(report);
  postCheckResultToUi(selection, finalScan);
}
