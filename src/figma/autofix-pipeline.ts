import type { AutoApplyReportDto, CheckResultDto } from "../shared/messages";
import { applyFixesFromScan } from "./apply-fixes";
import { buildAutoApplyReportFromApplied, buildEmptyAutoApplyReport, mergeAutoApplyReports } from "./build-auto-apply-report";
import { postCheckResultToUi, setLastAutoApplyReport } from "./post-check-result";
import { TEXT_REPLACEMENTS_CSV_URL } from "../config/text-replacements-remote-url";
import { isGoogleSheetsUrl } from "../sheet/google-sheets-url";
import { fetchCsvViaHttp, refreshTextReplacementsFromRemote } from "../sheet/refresh-from-remote";
import type { PluginToUiMessage, SheetLoadStatusDto } from "../shared/messages";
import { scanSelectedTextNodes } from "./scan-selection";
import { fetchGoogleSheetCsvViaUi } from "./sheet-fetch-via-ui";

/** Защита от зацикливания, если правила конфликтуют или текст не меняется. */
const MAX_AUTOFIX_PASSES = 20;

async function fetchCsvForSheet(fetchUrl: string): Promise<string> {
  if (isGoogleSheetsUrl(fetchUrl)) {
    return fetchGoogleSheetCsvViaUi(fetchUrl);
  }
  return fetchCsvViaHttp(fetchUrl);
}

export async function postPluginConfigToUi(sheetLoad?: SheetLoadStatusDto | null): Promise<void> {
  figma.ui.postMessage({
    type: "plugin:config",
    sheetLoad: sheetLoad ?? null,
  } satisfies PluginToUiMessage);
}

/** Сканирование → применение auto-правок в цикле; сводный отчёт. */
export async function runAutofixAutoPasses(
  selection: readonly SceneNode[],
  existingReport: AutoApplyReportDto | null = null,
): Promise<AutoApplyReportDto> {
  let mergedReport = existingReport;
  let totalApplied = existingReport?.summary.appliedFixCount ?? 0;
  let passCount = 0;

  while (passCount < MAX_AUTOFIX_PASSES) {
    const { result: scan, nodeById } = scanSelectedTextNodes(selection, { policy: "auto" });
    if (scan.summary.foundFixes === 0) break;

    const { appliedCount, appliedByNode } = await applyFixesFromScan(scan, nodeById);
    passCount += 1;
    totalApplied += appliedCount;

    if (appliedCount > 0) {
      mergedReport = mergeAutoApplyReports(
        mergedReport,
        buildAutoApplyReportFromApplied(scan, appliedByNode),
      );
    }

    if (appliedCount === 0) break;
  }

  const { result: scanAfter } = scanSelectedTextNodes(selection, { policy: "auto" });
  const report = mergedReport
    ? { ...mergedReport, summary: { ...mergedReport.summary, appliedFixCount: totalApplied } }
    : buildEmptyAutoApplyReport(scanAfter.summary.checkedLayers);

  if (scanAfter.summary.foundFixes > 0 && passCount >= MAX_AUTOFIX_PASSES) {
    console.warn(
      `[text-autofix] ${MAX_AUTOFIX_PASSES} passes reached with ${scanAfter.summary.foundFixes} fixes remaining`,
    );
  }

  return report;
}

/** Сканирование → применение в цикле, пока есть правки; сводный отчёт в UI. */
export async function runAutofixPipeline(): Promise<void> {
  const selection = figma.currentPage.selection;
  const sheetLoad = await refreshTextReplacementsFromRemote(
    TEXT_REPLACEMENTS_CSV_URL,
    fetchCsvForSheet,
  );
  await postPluginConfigToUi(sheetLoad);
  if (!sheetLoad.ok) {
    console.warn("[text-autofix] sheet load failed", sheetLoad);
  }

  const report = await runAutofixAutoPasses(selection);
  setLastAutoApplyReport(report);
  postCheckResultToUi(selection);

  const { result: scanAfter } = scanSelectedTextNodes(selection, { policy: "auto" });
  if (scanAfter.summary.foundFixes > 0 && report.summary.appliedFixCount === 0) {
    figma.notify(
      "Правки найдены, но не применились. Проверьте шрифты слоя или откройте консоль плагина.",
      { error: true },
    );
  }
}
