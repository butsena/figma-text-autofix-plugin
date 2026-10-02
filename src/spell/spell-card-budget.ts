/**
 * Сколько карточек orthography-spellcheck отдаём с одного слоя.
 * Дальше suggest не считаем: стена мусора не должна подвешивать запуск.
 */
export const MAX_SPELL_CARDS_PER_TEXT = 12;

/** Потолок таких карточек на один проход по выделению. */
export const MAX_SPELL_CARDS_PER_RUN = 48;

/** null — лимита на запуск нет (юнит-тесты одного текста). */
let runSlotsLeft: number | null = null;

export function beginSpellCardBudget(): void {
  runSlotsLeft = MAX_SPELL_CARDS_PER_RUN;
}

export function endSpellCardBudget(): void {
  runSlotsLeft = null;
}

/** false — карточку орфографии больше не создаём и suggest для неё не зовём. */
export function takeSpellCardSlot(emittedInText: number): boolean {
  if (emittedInText >= MAX_SPELL_CARDS_PER_TEXT) return false;
  if (runSlotsLeft === null) return true;
  if (runSlotsLeft <= 0) return false;
  runSlotsLeft -= 1;
  return true;
}
