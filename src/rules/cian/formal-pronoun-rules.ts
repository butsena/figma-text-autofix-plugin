import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import { CYRILLIC_WORD_EDGE, CYRILLIC_WORD_EDGE_END } from "../regex";
import { HORIZONTAL_SPACE } from "../typography/constants";

/** После точки/вопроса/восклицания/многоточия заглавная допустима (см. также replacement). */
const NOT_SENTENCE_START = String.raw`(?<!^)(?<![.!?…]${HORIZONTAL_SPACE}*)`;

/** Личное и притяжательное «вы»; длинные формы раньше в alternation. */
const FORMAL_YOU_FORMS = [
  "Вашими",
  "Вашего",
  "Вашему",
  "Ваших",
  "Вашей",
  "Вашим",
  "Вашем",
  "Вашу",
  "Ваша",
  "Ваше",
  "Ваши",
  "Вами",
  "Ваш",
  "Вас",
  "Вам",
  "Вы",
].join("|");

function replaceFormalPronoun(_match: string, prefix: string, word: string): string {
  if (prefix === "" || /[\r\n]/.test(prefix)) {
    return `${prefix}${word}`;
  }
  return `${prefix}${word.toLowerCase()}`;
}

export function buildFormalPronounRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-formal-pronoun-lowercase",
      category: "cian_editorial",
      pattern: new RegExp(
        `${NOT_SENTENCE_START}${CYRILLIC_WORD_EDGE}(${FORMAL_YOU_FORMS})${CYRILLIC_WORD_EDGE_END}`,
        "gu",
      ),
      replacement: replaceFormalPronoun,
      message:
        "Редполитика: «вы», его формы и притяжательное «ваш» в середине предложения — с маленькой буквы.",
      priority: 58,
    }),
  ]);
}
