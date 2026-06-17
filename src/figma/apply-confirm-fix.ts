import {
  buildAutoApplyReportFromConfirmFix,
  mergeAutoApplyReports,
} from "./build-auto-apply-report";
import { runAutofixAutoPasses } from "./autofix-pipeline";
import { applyTextFixesToTextNode } from "./apply-fixes";
import {
  getLastAutoApplyReport,
  postCheckResultToUi,
  setLastAutoApplyReport,
} from "./check-result-session";
import type { TextFixDto } from "../shared/messages";
import { textFixDtoToEngineFix } from "../shared/text-fix-mapping";

export async function applyConfirmFixAndRefresh(
  nodeId: string,
  fix: TextFixDto,
): Promise<void> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || node.type !== "TEXT") return;

  const sourceText = node.characters;
  const applied = await applyTextFixesToTextNode(node, [textFixDtoToEngineFix(fix)]);

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
