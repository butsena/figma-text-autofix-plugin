import type { PluginToUiMessage } from "../shared/messages";
import { initUiEvents } from "./ui-events";
import { sendToPlugin } from "./ui-plugin-bridge";
import { render, renderPluginError } from "./ui-render";
import { applyCheckResult, applyLexiconConfig, resetForError } from "./ui-state";

export function handlePluginMessage(event: MessageEvent): void {
  const msg = event.data && (event.data as { pluginMessage?: PluginToUiMessage }).pluginMessage;
  if (!msg) return;

  if (msg.type === "plugin:error") {
    resetForError();
    renderPluginError(msg.message || "Неизвестная ошибка");
    return;
  }

  if (msg.type === "plugin:config") {
    applyLexiconConfig(msg.lexiconLoad != null ? msg.lexiconLoad : null);
    render();
    return;
  }

  if (msg.type === "plugin:checkResult") {
    applyCheckResult({
      summary: msg.result.summary,
      checkedTextLayers: msg.result.checkedTextLayers || [],
      lastAutoApplyReport: msg.result.lastAutoApplyReport != null ? msg.result.lastAutoApplyReport : null,
      cards: msg.result.cards,
      confirmCards: msg.result.confirmCards || [],
      choiceCards: msg.result.choiceCards || [],
    });
    render();
  }
}

export function bootstrapUi(): void {
  initUiEvents();
  window.addEventListener("message", handlePluginMessage);
  sendToPlugin({ type: "ui:ready" });
  render();
}
