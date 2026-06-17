import uiHtml from "./ui/ui.figma.html?raw";
import { collectTextNodesFromSelection } from "./figma/collect-text-nodes";
import { runAutofixPipeline } from "./figma/autofix-pipeline";
import { applyConfirmFixAndRefresh } from "./figma/apply-confirm-fix";
import { focusLayerById } from "./figma/focus-layer";
import {
  PLUGIN_UI_INITIAL_HEIGHT,
  PLUGIN_UI_MAX_HEIGHT,
  PLUGIN_UI_MIN_HEIGHT,
  PLUGIN_UI_WIDTH,
} from "./shared/plugin-ui-layout";
import { NO_TEXT_IN_SELECTION_NOTICE, type PluginToUiMessage, type UiToPluginMessage } from "./shared/messages";

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
        case "ui:applyConfirmFix": {
          await applyConfirmFixAndRefresh(message.nodeId, message.fix);
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
