import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import { CYRILLIC_WORD_EDGE, CYRILLIC_WORD_EDGE_END, escapeRegex } from "../regex";
import { HORIZONTAL_SPACE, LINE_BREAK } from "../typography/constants";
import {
  TY_VY_PRONOUN_PAIRS,
  capitalizeCyrillicFirst,
  collectTySurfaceForms,
} from "./ty-vy-pronoun-forms";

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

/** После точки/вопроса/восклицания/многоточия или перевода строки заглавная допустима. */
const SENTENCE_START = String.raw`(?<=^|[.!?…]${HORIZONTAL_SPACE}*|${LINE_BREAK}${HORIZONTAL_SPACE}*)`;

/** После точки/вопроса/восклицания/многоточия заглавная допустима (см. также replacement). */
const NOT_SENTENCE_START = String.raw`(?<!^)(?<![.!?…]${HORIZONTAL_SPACE}*)(?<![\r\n]${HORIZONTAL_SPACE}*)`;

const TY_TO_VY_MESSAGE =
  "Обращение на «вы»: заменить форму обращения «ты» / «твой» на «вы» / «ваш».";

function buildTyVyPronounConversionRules(): AutofixRule[] {
  const out: AutofixRule[] = [];
  let idx = 0;

  for (const [ty, vy] of TY_VY_PRONOUN_PAIRS) {
    for (const surface of collectTySurfaceForms(ty)) {
      const alt = escapeRegex(surface);
      const formalStart = capitalizeCyrillicFirst(vy);

      out.push(
        rule({
          id: `cian-ty-pronoun-start-${idx}`,
          category: "cian_editorial",
          pattern: new RegExp(`${SENTENCE_START}(${alt})${CYRILLIC_WORD_EDGE_END}`, "gu"),
          replacement: formalStart,
          message: TY_TO_VY_MESSAGE,
          priority: 57,
        }),
        rule({
          id: `cian-ty-pronoun-mid-${idx}`,
          category: "cian_editorial",
          pattern: new RegExp(
            `${NOT_SENTENCE_START}${CYRILLIC_WORD_EDGE}(${alt})${CYRILLIC_WORD_EDGE_END}`,
            "gu",
          ),
          replacement: (_match, prefix) => `${prefix}${vy}`,
          message: TY_TO_VY_MESSAGE,
          priority: 57,
        }),
      );
      idx += 1;
    }
  }

  return out;
}

function replaceFormalPronoun(_match: string, prefix: string, word: string): string {
  if (prefix === "" || /[\r\n]/.test(prefix)) {
    return `${prefix}${word}`;
  }
  return `${prefix}${word.toLowerCase()}`;
}

export function buildFormalPronounRules(): AutofixRule[] {
  return rules([
    ...buildTyVyPronounConversionRules(),
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
