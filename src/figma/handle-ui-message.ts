import { trackPluginError, trackSpellcheckRequested } from "../analytics/pipeline-events";
import { enableSpellcheckForSession } from "../config/spellcheck-preference";
import {
  applyManualFixAndRefresh,
  applyManualFixBatchAndRefresh,
  skipManualFixAndRefresh,
} from "./apply-manual-fix";
import { runAutofixPipeline } from "./autofix-pipeline";
import { focusLayerById } from "./focus-layer";
import { clampPluginUiHeight } from "../shared/plugin-ui-layout";
import type { UiToPluginMessage } from "../shared/messages";

export type UiMessageGate = {
  uiReady: boolean;
  runPipelineWhenReady: boolean;
};

export function resizePluginUi(width: number, height: number): void {
  figma.ui.resize(width, clampPluginUiHeight(height));
}

export async function handleUiMessage(
  message: UiToPluginMessage,
  gate: UiMessageGate,
): Promise<void> {
  try {
    await dispatchUiMessage(message, gate);
  } catch (error) {
    // One owner for the entire UI operation, including errors rethrown to main.
    const stage = message?.type === "ui:applyManualFix" ||
      message?.type === "ui:applyFixBatch" ||
      message?.type === "ui:skipManualFix"
      ? "manual_apply" : message?.type === "ui:ready" || message?.type === "ui:enableSpellcheck"
        ? "open" : "ui";
    trackPluginError(stage, error);
    throw error;
  }
}

async function dispatchUiMessage(
  message: UiToPluginMessage,
  gate: UiMessageGate,
): Promise<void> {
  switch (message.type) {
    case "ui:ready": {
      gate.uiReady = true;
      if (gate.runPipelineWhenReady) {
        gate.runPipelineWhenReady = false;
        await runAutofixPipeline();
      }
      break;
    }
    case "ui:applyManualFix": {
      await applyManualFixAndRefresh(message.nodeId, message.fix, message.spellingSource);
      break;
    }
    case "ui:applyFixBatch": {
      await applyManualFixBatchAndRefresh(message.fixes);
      break;
    }
    case "ui:skipManualFix": {
      await skipManualFixAndRefresh(message.nodeId, message.fix);
      break;
    }
    case "ui:enableSpellcheck": {
      if (enableSpellcheckForSession()) trackSpellcheckRequested();
      await runAutofixPipeline();
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
}
