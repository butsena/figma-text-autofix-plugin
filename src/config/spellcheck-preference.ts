import { SPELLCHECK_ENABLED } from "./feature-flags";

/** Флаг только на текущий open плагина. Между сессиями не сохраняется. */
let sessionEnabled = false;

/** Фича доступна в сборке и пользователь включил орфографию в этом запуске. */
export function isSpellcheckActive(preference: boolean): boolean {
  return SPELLCHECK_ENABLED && preference;
}

/** Эффективный флаг для пайплайна / скана. */
export function getCachedSpellcheckActive(): boolean {
  return isSpellcheckActive(sessionEnabled);
}

/** Пользовательский флаг сессии (для UI), без учёта kill-switch. */
export function getCachedSpellcheckPreference(): boolean {
  return sessionEnabled;
}

/**
 * Состояние сессии для пайплайна.
 * Не читает storage: каждый open начинается с выкл.
 */
export function loadSpellcheckPreference(): boolean {
  if (!SPELLCHECK_ENABLED) {
    sessionEnabled = false;
    return false;
  }
  return isSpellcheckActive(sessionEnabled);
}

/** Включить орфографию до конца этого open. */
export function enableSpellcheckForSession(): boolean {
  if (!SPELLCHECK_ENABLED) {
    sessionEnabled = false;
    return false;
  }
  sessionEnabled = true;
  return true;
}

/** Только для тестов. */
export function resetSpellcheckPreferenceCacheForTests(): void {
  sessionEnabled = false;
}
