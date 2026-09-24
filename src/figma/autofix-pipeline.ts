import type { AutoApplyReportDto, CheckResultDto } from "../shared/messages";
import { SPELLCHECK_ENABLED } from "../config/feature-flags";
import { applyFixesFromScan } from "./apply-fixes";
import { buildAutoApplyReportFromApplied, buildEmptyAutoApplyReport, mergeAutoApplyReports } from "./build-auto-apply-report";
import { postCheckResultToUi, setLastAutoApplyReport } from "./check-result-session";
import {
  refreshLexiconFromRemote,
  refreshSpellLexiconFromRemote,
} from "../lexicon/refresh-lexicon";
import { ensureSpellCheckerReady } from "../spell/spell-checker";
import type { LexiconLoadStatusDto, PluginToUiMessage } from "../shared/messages";
import { scanSelectedTextNodes } from "./scan-selection";

/** Защита от зацикливания, если правила конфликтуют или текст не меняется. */
const MAX_AUTOFIX_PASSES = 20;

export type AutofixAutoPassesResult = {
  report: AutoApplyReportDto;
  finalScan: CheckResultDto;
};

export async function postPluginConfigToUi(lexiconLoad?: LexiconLoadStatusDto | null): Promise<void> {
  figma.ui.postMessage({
    type: "plugin:config",
    lexiconLoad: lexiconLoad ?? null,
  } satisfies PluginToUiMessage);
}

function notifyIfFixesStuck(scan: CheckResultDto, report: AutoApplyReportDto): void {
  if (scan.summary.foundFixes > 0 && report.summary.appliedFixCount === 0) {
    figma.notify(
      "Правки найдены, но не применились. Проверьте шрифты слоя или откройте консоль плагина.",
      { error: true },
    );
  }
}

/** Сканирование → применение auto-правок в цикле; сводный отчёт. */
export async function runAutofixAutoPasses(
  selection: readonly SceneNode[],
  existingReport: AutoApplyReportDto | null = null,
): Promise<AutofixAutoPassesResult> {
  let mergedReport = existingReport;
  let totalApplied = existingReport?.summary.appliedFixCount ?? 0;
  let passCount = 0;

  while (passCount < MAX_AUTOFIX_PASSES) {
    const { result: scan, nodeById } = scanSelectedTextNodes(selection, {
      policy: "auto",
      includeSpelling: false,
      autoApplyOnly: true,
    });
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

  const { result: finalScan } = scanSelectedTextNodes(selection, {
    policy: "auto",
    includeSpelling: false,
    autoApplyOnly: true,
  });
  const report = mergedReport
    ? { ...mergedReport, summary: { ...mergedReport.summary, appliedFixCount: totalApplied } }
    : buildEmptyAutoApplyReport(finalScan.summary.checkedLayers);

  if (finalScan.summary.foundFixes > 0 && passCount >= MAX_AUTOFIX_PASSES) {
    console.warn(
      `[text-autofix] ${MAX_AUTOFIX_PASSES} passes reached with ${finalScan.summary.foundFixes} fixes remaining`,
    );
  }

  return { report, finalScan };
}

function postSpellcheckStatus(active: boolean): void {
  figma.ui.postMessage({
    type: "plugin:spellcheckStatus",
    active,
  } satisfies PluginToUiMessage);
}

/** Сканирование → применение в цикле, пока есть правки; сводный отчёт в UI. */
export async function runAutofixPipeline(): Promise<void> {
  const selection = figma.currentPage.selection;
  // Сначала только редакционные словари — без ~2 МБ Hunspell на критическом пути.
  const lexiconLoad = await refreshLexiconFromRemote({ includeSpell: false });
  await postPluginConfigToUi(lexiconLoad);

  const { report, finalScan } = await runAutofixAutoPasses(selection);
  setLastAutoApplyReport(report);
  // Быстрый UI без орфографии, чтобы auto/choice/confirm не ждали nspell.
  postCheckResultToUi(
    selection,
    scanSelectedTextNodes(selection, { policy: "auto", includeSpelling: false }).result,
  );
  notifyIfFixesStuck(finalScan, report);

  if (SPELLCHECK_ENABLED) {
    postSpellcheckStatus(true);
    try {
      const spellLexiconLoad = await refreshSpellLexiconFromRemote();
      await ensureSpellCheckerReady();
      await postPluginConfigToUi(spellLexiconLoad);
      // Полный скан с орфографией — вторым проходом после показа основных правок.
      postCheckResultToUi(selection);
    } finally {
      postSpellcheckStatus(false);
    }
  }
}
