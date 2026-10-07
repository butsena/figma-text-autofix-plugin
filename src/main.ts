import uiHtml from "./ui/ui.figma.html?raw";
import { beginAnalyticsSession } from "./analytics/track";
import { trackPluginError, trackPluginOpen } from "./analytics/pipeline-events";
import { collectTextNodesFromSelection } from "./figma/collect-text-nodes";
import { beginPluginRun } from "./figma/choice-resolution";
import { runAutofixPipeline } from "./figma/autofix-pipeline";
import { handleUiMessage, type UiMessageGate } from "./figma/handle-ui-message";
import { postPluginError } from "./figma/plugin-ui-messages";
import {
  PLUGIN_UI_INITIAL_HEIGHT,
  PLUGIN_UI_WIDTH,
} from "./shared/plugin-ui-layout";
import { NO_TEXT_IN_SELECTION_NOTICE, type UiToPluginMessage } from "./shared/messages";

beginPluginRun();
beginAnalyticsSession();

/** Пауза, чтобы красный тост успели прочитать: closePlugin сразу гасит notify. */
const EMPTY_SELECTION_TOAST_MS = 2500;

const selection = figma.currentPage.selection;
if (collectTextNodesFromSelection(selection).length === 0) {
  trackPluginOpen(false);
  // closePlugin(текст) всегда серый, флага error у него нет.
  figma.notify(NO_TEXT_IN_SELECTION_NOTICE, { error: true });
  setTimeout(() => {
    figma.closePlugin();
  }, EMPTY_SELECTION_TOAST_MS);
} else {
  trackPluginOpen(true);
  figma.showUI(uiHtml, { width: PLUGIN_UI_WIDTH, height: PLUGIN_UI_INITIAL_HEIGHT });

  const gate: UiMessageGate = {
    uiReady: false,
    runPipelineWhenReady: false,
  };

  figma.ui.onmessage = async (rawMessage: unknown) => {
    try {
      await handleUiMessage(rawMessage as UiToPluginMessage, gate);
    } catch (e) {
      trackPluginError("ui", e);
      postPluginError(e instanceof Error ? e.message : String(e));
    }
  };

  void (async () => {
    try {
      if (gate.uiReady) {
        await runAutofixPipeline();
      } else {
        gate.runPipelineWhenReady = true;
      }
    } catch (e) {
      trackPluginError("open", e);
      postPluginError(e instanceof Error ? e.message : String(e));
    }
  })();
}
