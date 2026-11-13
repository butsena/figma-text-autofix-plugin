import { getCachedSpellcheckPreference } from "../config/spellcheck-preference";
import type { AutofixProgressDto, LexiconLoadStatusDto, PluginToUiMessage } from "../shared/messages";

export function postPluginConfigToUi(lexiconLoad?: LexiconLoadStatusDto | null): void {
  figma.ui.postMessage({
    type: "plugin:config",
    lexiconLoad: lexiconLoad ?? null,
    spellcheckEnabled: getCachedSpellcheckPreference(),
  } satisfies PluginToUiMessage);
}

export function postAutofixProgress(progress: AutofixProgressDto): void {
  figma.ui.postMessage({
    type: "plugin:autofixProgress",
    progress,
  } satisfies PluginToUiMessage);
}

export function postSpellcheckStatus(active: boolean): void {
  figma.ui.postMessage({
    type: "plugin:spellcheckStatus",
    active,
  } satisfies PluginToUiMessage);
}

export function postPluginError(message: string): void {
  figma.ui.postMessage({ type: "plugin:error", message } satisfies PluginToUiMessage);
}
