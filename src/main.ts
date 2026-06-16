import uiHtml from "./ui/ui.html?raw";
import { collectTextNodesFromSelection } from "./figma/collect-text-nodes";
import { runAutofixAutoPasses, runAutofixPipeline } from "./figma/autofix-pipeline";
import { focusLayerById } from "./figma/focus-layer";
import { applyTextFixesToTextNode } from "./figma/apply-fixes";
import {
  buildAutoApplyReportFromConfirmFix,
  mergeAutoApplyReports,
} from "./figma/build-auto-apply-report";
import { getLastAutoApplyReport, postCheckResultToUi, setLastAutoApplyReport } from "./figma/post-check-result";
import { resolvePendingSheetCsv } from "./figma/sheet-fetch-via-ui";
import { NO_TEXT_IN_SELECTION_NOTICE, type PluginToUiMessage, type UiToPluginMessage } from "./shared/messages";

const PLUGIN_UI_WIDTH = 390;
const PLUGIN_UI_MIN_HEIGHT = 220;
const PLUGIN_UI_MAX_HEIGHT = 750;
const PLUGIN_UI_INITIAL_HEIGHT = 260;

function clampPluginHeight(height: number): number {
  return Math.max(PLUGIN_UI_MIN_HEIGHT, Math.min(PLUGIN_UI_MAX_HEIGHT, Math.round(height)));
}

function resizePluginUi(width: number, height: number): void {
  figma.ui.resize(width, clampPluginHeight(height));
}

const selection = figma.currentPage.selection;
if (collectTextNodesFromSelection(selection).length === 0) {
  figma.notify(NO_TEXT_IN_SELECTION_NOTICE, { error: true });
} else {
  figma.showUI(uiHtml, { width: PLUGIN_UI_WIDTH, height: PLUGIN_UI_INITIAL_HEIGHT });

  let uiReady = false;
  let runPipelineWhenReady = false;

  function postError(message: string): void {
    figma.ui.postMessage({ type: "plugin:error", message } satisfies PluginToUiMessage);
  }

  figma.ui.onmessage = async (rawMessage: unknown) => {
    const message = rawMessage as UiToPluginMessage;
    try {
      switch (message.type) {
        case "ui:ready": {
          uiReady = true;
          if (runPipelineWhenReady) {
            runPipelineWhenReady = false;
            await runAutofixPipeline();
          }
          break;
        }
        case "ui:sheetCsvResult": {
          resolvePendingSheetCsv(
            message.requestId,
            message.ok,
            message.csv,
            message.errorMessage,
          );
          break;
        }
        case "ui:applyConfirmFix": {
          const node = await figma.getNodeByIdAsync(message.nodeId);
          if (!node || node.type !== "TEXT") break;
          const sourceText = node.characters;
          const fix = {
            from: message.fix.from,
            to: message.fix.to,
            before: message.fix.before,
            after: message.fix.after,
            ruleId: message.fix.rule.id,
            category: message.fix.rule.category,
            message: message.fix.rule.message,
            priority: message.fix.rule.priority,
            applyPolicy: message.fix.rule.applyPolicy,
          };
          const applied = await applyTextFixesToTextNode(node, [fix]);
          const selection = figma.currentPage.selection;
          let reportBase = getLastAutoApplyReport();
          if (applied.length > 0) {
            reportBase = mergeAutoApplyReports(
              reportBase,
              buildAutoApplyReportFromConfirmFix(
                node.id,
                node.name,
                message.fix,
                sourceText,
              ),
            );
          }
          const report = await runAutofixAutoPasses(selection, reportBase);
          setLastAutoApplyReport(report);
          postCheckResultToUi(selection);
          break;
        }
        case "ui:resize": {
          resizePluginUi(message.width, message.height);
          break;
        }
        case "ui:focusLayer": {
          await focusLayerById(message.nodeId);
          break;
        }
        case "ui:close": {
          figma.closePlugin();
          break;
        }
        default:
          break;
      }
    } catch (e) {
      postError(e instanceof Error ? e.message : String(e));
    }
  };

  void (async () => {
    try {
      if (uiReady) {
        await runAutofixPipeline();
      } else {
        runPipelineWhenReady = true;
      }
    } catch (e) {
      postError(e instanceof Error ? e.message : String(e));
    }
  })();
}
