export const ORTHOGRAPHY_SPELL_RULE_ID = "orthography-spellcheck";
export const ORTHOGRAPHY_LAYOUT_RULE_ID = "orthography-keyboard-layout";

export function isOrthographyRuleId(ruleId: string): boolean {
  return ruleId === ORTHOGRAPHY_SPELL_RULE_ID || ruleId === ORTHOGRAPHY_LAYOUT_RULE_ID;
}

export function orthographySpellMessage(word: string): string {
  return `Возможно, в слове «${word}» опечатка или ошибка — проверьте`;
}

export function orthographyLayoutMessage(word: string): string {
  return `Возможно, «${word}» набрано в английской раскладке или это опечатка — проверьте`;
}

export const ORTHOGRAPHY_SPELL_PRIORITY = 72;
export const ORTHOGRAPHY_LAYOUT_PRIORITY = 73;
