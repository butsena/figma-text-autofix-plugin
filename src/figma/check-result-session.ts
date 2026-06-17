import type { AutoApplyReportDto, CheckResultDto } from "../shared/messages";
import type { PluginToUiMessage } from "../shared/messages";
import { scanSelectedTextNodes } from "./scan-selection";

let lastAutoApplyReport: AutoApplyReportDto | null = null;

export function setLastAutoApplyReport(report: AutoApplyReportDto | null): void {
  lastAutoApplyReport = report;
}

export function getLastAutoApplyReport(): AutoApplyReportDto | null {
  return lastAutoApplyReport;
}

export function buildCheckResultForUi(
  selection: readonly SceneNode[],
  scan?: CheckResultDto,
): CheckResultDto {
  const scanResult = scan ?? scanSelectedTextNodes(selection, { policy: "auto" }).result;
  return {
    ...scanResult,
    lastAutoApplyReport,
  };
}

export function postCheckResultToUi(
  selection: readonly SceneNode[],
  scan?: CheckResultDto,
): void {
  figma.ui.postMessage({
    type: "plugin:checkResult",
    result: buildCheckResultForUi(selection, scan),
  } satisfies PluginToUiMessage);
}
