import type { AutoApplyReportDto, CheckResultDto, PluginToUiMessage } from "../shared/messages";
import { trackScanComplete } from "../analytics/pipeline-events";
import { scanSelectedTextNodes } from "./scan-selection";

let lastAutoApplyReport: AutoApplyReportDto | null = null;
let lastManualApplyReport: AutoApplyReportDto | null = null;

export function setLastAutoApplyReport(report: AutoApplyReportDto | null): void {
  lastAutoApplyReport = report;
}

export function getLastAutoApplyReport(): AutoApplyReportDto | null {
  return lastAutoApplyReport;
}

export function setLastManualApplyReport(report: AutoApplyReportDto | null): void {
  lastManualApplyReport = report;
}

export function getLastManualApplyReport(): AutoApplyReportDto | null {
  return lastManualApplyReport;
}

export function buildCheckResultForUi(
  selection: readonly SceneNode[],
  scan?: CheckResultDto,
): CheckResultDto {
  const scanResult = scan ?? scanSelectedTextNodes(selection, { policy: "auto" }).result;
  return {
    ...scanResult,
    lastAutoApplyReport,
    lastManualApplyReport,
  };
}

export function postCheckResultToUi(
  selection: readonly SceneNode[],
  scan?: CheckResultDto,
): void {
  const scanStartedAt = Date.now();
  const scanResult = scan ?? scanSelectedTextNodes(selection, { policy: "auto" }).result;
  trackScanComplete(scanResult.summary, Date.now() - scanStartedAt);
  figma.ui.postMessage({
    type: "plugin:checkResult",
    result: {
      ...scanResult,
      lastAutoApplyReport,
      lastManualApplyReport,
    },
  } satisfies PluginToUiMessage);
}
