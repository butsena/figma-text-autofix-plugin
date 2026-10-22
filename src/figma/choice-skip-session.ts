/**
 * Сколько раз подряд можно пропустить орфографию в разных запусках плагина,
 * прежде чем скрыть навсегда. Один skip в рамках одного запуска.
 */
export const MAX_SPELL_SKIP_COUNT = 3;

/**
 * Ключи орфо-skip в текущем открытии плагина (in-memory).
 * При закрытии/открытии плагина sandbox пересоздаётся — Set пустой, слово снова видно.
 * Счётчик skipCount при этом живёт в pluginData на ноде.
 */
const skippedThisPluginSession = new Set<string>();

function spellSkipSessionKey(ruleId: string, before: string): string {
  return `${ruleId}\0${before}`;
}

/** Новый запуск плагина (или симуляция в тестах): сбросить «скрыто в этой сессии». */
export function beginPluginRun(): void {
  skippedThisPluginSession.clear();
}

export function wasSpellSkippedThisSession(ruleId: string, before: string): boolean {
  return skippedThisPluginSession.has(spellSkipSessionKey(ruleId, before));
}

export function markSpellSkippedThisSession(ruleId: string, before: string): void {
  skippedThisPluginSession.add(spellSkipSessionKey(ruleId, before));
}
