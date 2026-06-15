import uiHtml from "./ui/ui.html?raw";
import { collectTextNodesFromSelection } from "./figma/collect-text-nodes";
import { runAutofixPipeline } from "./figma/autofix-pipeline";
import { focusLayerById } from "./figma/focus-layer";
import { resolvePendingSheetCsv } from "./figma/sheet-fetch-via-ui";
import { NO_TEXT_IN_SELECTION_NOTICE, type PluginToUiMessage, type UiToPluginMessage } from "./shared/messages";

const selection = figma.currentPage.selection;
if (collectTextNodesFromSelection(selection).length === 0) {
  figma.notify(NO_TEXT_IN_SELECTION_NOTICE, { error: true });
} else {
  figma.showUI(uiHtml, { width: 390, height: 440 });

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
