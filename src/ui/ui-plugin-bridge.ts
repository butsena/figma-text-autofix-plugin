import type { UiToPluginMessage } from "../shared/messages";

export function sendToPlugin(message: UiToPluginMessage): void {
  parent.postMessage({ pluginMessage: message }, "*");
}
