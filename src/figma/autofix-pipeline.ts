import type { AutoApplyReportDto, CheckResultDto } from "../shared/messages";
import { trackAutoFixComplete, trackPluginError } from "../analytics/pipeline-events";
import { annotateFailure } from "../analytics/failure";
import {
  getCachedSpellcheckActive,
  loadSpellcheckPreference,
} from "../config/spellcheck-preference";
import { applyFixesFromScan } from "./apply-fixes";
import { buildAutoApplyReportFromApplied, buildEmptyAutoApplyReport, mergeAutoApplyReports } from "./build-auto-apply-report";
import { anchorCheckedTextNodes, postCheckResultToUi, setLastAutoApplyReport } from "./check-result-session";
import {
  refreshLexiconFromRemote,
  refreshSpellLexiconFromRemote,
} from "../lexicon/refresh-lexicon";
import { ensureSpellCheckerReady } from "../spell/spell-checker";
import { postAutofixProgress, postPluginConfigToUi, postSpellcheckStatus } from "./plugin-ui-messages";
import { scanSelectedTextNodes } from "./scan-selection";

/** Защита от зацикливания, если правила конфликтуют или текст не меняется. */
const MAX_AUTOFIX_PASSES = 20;

export type AutofixAutoPassesResult = {
  report: AutoApplyReportDto;
  finalScan: CheckResultDto;
};

function notifyIfFixesStuck(scan: CheckResultDto, report: AutoApplyReportDto): void {
  if (scan.summary.foundFixes > 0 && report.summary.appliedFixCount === 0) {
    figma.notify(
      "Правки найдены, но не применились. Проверьте шрифты слоя или откройте консоль плагина.",
      { error: true },
    );
  }
}

export type AutofixAutoPassesOptions = {
  /** Полоска на экране ожидания. Добор после ручной правки её не трогает. */
  reportProgress?: boolean;
};

/** Сканирование → применение auto-правок в цикле; сводный отчёт. */
export async function runAutofixAutoPasses(
  selection: readonly SceneNode[],
  existingReport: AutoApplyReportDto | null = null,
  options: AutofixAutoPassesOptions = {},
): Promise<AutofixAutoPassesResult> {
  let mergedReport = existingReport;
  let totalApplied = existingReport?.summary.appliedFixCount ?? 0;
  let passCount = 0;
  const failedFontsByNode = new Map<string, Set<string>>();
  let dirtyIds: ReadonlySet<string> | undefined;
  let lastScan: CheckResultDto | null = null;
  let needFinalScan = true;

  while (passCount < MAX_AUTOFIX_PASSES) {
    const { result: scan, nodeById } = scanSelectedTextNodes(selection, {
      policy: "auto",
      includeSpelling: false,
      autoApplyOnly: true,
      onlyNodeIds: dirtyIds,
    });
    lastScan = scan;
    if (scan.summary.foundFixes === 0) {
      needFinalScan = false;
      break;
    }

    const passStart = totalApplied;
    const passTotal = passStart + scan.summary.foundFixes;
    if (options.reportProgress) {
      postAutofixProgress({ phase: "apply", applied: passStart, total: passTotal });
    }

    const { appliedCount, appliedByNode } = await applyFixesFromScan(
      scan,
      nodeById,
      failedFontsByNode,
      options.reportProgress
        ? (appliedInBatch) => {
            postAutofixProgress({
              phase: "apply",
              applied: passStart + appliedInBatch,
              total: passTotal,
            });
          }
        : undefined,
    );
    passCount += 1;
    totalApplied += appliedCount;

    if (appliedCount > 0) {
      mergedReport = mergeAutoApplyReports(
        mergedReport,
        buildAutoApplyReportFromApplied(scan, appliedByNode),
      );
    }

    if (appliedCount === 0) {
      needFinalScan = false;
      break;
    }
    dirtyIds = new Set(appliedByNode.keys());
  }

  if (needFinalScan) {
    const { result: afterLastApply } = scanSelectedTextNodes(selection, {
      policy: "auto",
      includeSpelling: false,
      autoApplyOnly: true,
      onlyNodeIds: dirtyIds,
    });
    lastScan = afterLastApply;
  }

  const finalScan = lastScan ?? scanSelectedTextNodes(selection, {
    policy: "auto",
    includeSpelling: false,
    autoApplyOnly: true,
  }).result;
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

/** Сканирование → применение в цикле, пока есть правки; сводный отчёт в UI. */
export async function runAutofixPipeline(): Promise<void> {
  const selection = figma.currentPage.selection;
  anchorCheckedTextNodes(selection);
  const autoStartedAt = Date.now();
  const spellActive = loadSpellcheckPreference();
  // Пока Hunspell не готов, в UI только плашка: choice/confirm/отчёты не показываем.
  if (spellActive) {
    postSpellcheckStatus(true);
    postAutofixProgress({ phase: "spell", applied: 0, total: 0 });
  } else {
    postAutofixProgress({ phase: "lexicon", applied: 0, total: 0 });
  }

  try {
    if (spellActive) {
      try {
        await refreshSpellLexiconFromRemote()
          .catch((error) => { throw annotateFailure(error, "lexicon", "lexicon_load_failed"); });
        await ensureSpellCheckerReady()
          .catch((error) => { throw annotateFailure(error, "spell", "spell_init_failed"); });
      } catch (error) {
        trackPluginError("spell", error);
        console.warn("[text-autofix] spellcheck failed, continuing with other rules", error);
      }
    }

    const lexiconLoad = await refreshLexiconFromRemote({
      includeSpell: getCachedSpellcheckActive(),
    }).catch((error) => { throw annotateFailure(error, "lexicon", "lexicon_load_failed"); });
    postPluginConfigToUi(lexiconLoad);

    const { report, finalScan } = await runAutofixAutoPasses(selection, null, {
      reportProgress: true,
    });
    setLastAutoApplyReport(report);
    trackAutoFixComplete(report, finalScan.summary.foundFixes, Date.now() - autoStartedAt);
    // Один отчёт после орфографии: авто, choice и confirm не вспыхивают раньше.
    postCheckResultToUi(selection);
    notifyIfFixesStuck(finalScan, report);
  } finally {
    if (spellActive) postSpellcheckStatus(false);
  }
}
