import { TEXT_REPLACEMENTS_CSV_URL } from "../config/text-replacements-remote-url";
import { isGoogleSheetsUrl } from "../sheet/google-sheets-url";
import { fetchCsvViaHttp, refreshTextReplacementsFromRemote } from "../sheet/refresh-from-remote";
import type { PluginToUiMessage, SheetLoadStatusDto } from "../shared/messages";
import { applyFixesFromScan } from "./apply-fixes";
import { buildAutoApplyReport, mergeAutoApplyReports } from "./build-auto-apply-report";
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

  let mergedReport: ReturnType<typeof buildAutoApplyReport> | null = null;
  let totalApplied = 0;
  let passCount = 0;

  while (passCount < MAX_AUTOFIX_PASSES) {
    const scan = scanSelectedTextNodes(selection);
    if (scan.summary.foundFixes === 0) break;

    const applied = await applyFixesFromScan(scan);
    passCount += 1;
    totalApplied += applied;
    mergedReport = mergeAutoApplyReports(mergedReport, buildAutoApplyReport(scan));

    if (applied === 0) break;
  }

  const scanAfter = scanSelectedTextNodes(selection);
  const report = mergedReport
    ? { ...mergedReport, summary: { ...mergedReport.summary, appliedFixCount: totalApplied } }
    : buildAutoApplyReport(scanAfter);

  figma.ui.postMessage({
    type: "plugin:checkResult",
    result: { ...scanAfter, lastAutoApplyReport: report },
  } satisfies PluginToUiMessage);

  if (scanAfter.summary.foundFixes > 0 && passCount >= MAX_AUTOFIX_PASSES) {
    console.warn(
      `[text-autofix] ${MAX_AUTOFIX_PASSES} passes reached with ${scanAfter.summary.foundFixes} fixes remaining`,
    );
  }
}
