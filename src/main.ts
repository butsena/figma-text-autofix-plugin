import uiHtml from "./ui/ui.figma.html?raw";
import { collectTextNodesFromSelection } from "./figma/collect-text-nodes";
import { beginPluginRun } from "./figma/choice-resolution";
import { runAutofixPipeline } from "./figma/autofix-pipeline";
import { applyManualFixAndRefresh, skipManualFixAndRefresh } from "./figma/apply-manual-fix";
import { focusLayerById } from "./figma/focus-layer";
import {
  PLUGIN_UI_INITIAL_HEIGHT,
  PLUGIN_UI_WIDTH,
  clampPluginUiHeight,
} from "./shared/plugin-ui-layout";
import { NO_TEXT_IN_SELECTION_NOTICE, type PluginToUiMessage, type UiToPluginMessage } from "./shared/messages";

beginPluginRun();

function resizePluginUi(width: number, height: number): void {
  figma.ui.resize(width, clampPluginUiHeight(height));
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
        case "ui:applyManualFix": {
          await applyManualFixAndRefresh(message.nodeId, message.fix);
          break;
        }
        case "ui:skipManualFix": {
          await skipManualFixAndRefresh(message.nodeId, message.fix);
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
