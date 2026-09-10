export const ORTHOGRAPHY_SPELL_RULE_ID = "orthography-spellcheck";

export function orthographySpellMessage(word: string): string {
  return `Возможно в слове «${word}» опечатка или ошибка — проверьте`;
}

export const ORTHOGRAPHY_SPELL_PRIORITY = 72;
