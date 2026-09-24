import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import { CYRILLIC_WORD_EDGE, CYRILLIC_WORD_EDGE_END, escapeRegex } from "../regex";
import { HORIZONTAL_SPACE, LINE_BREAK } from "../typography/constants";
import { findImplicitSentenceBoundaryIndices } from "../typography/sentence-split";
import { MSG_RED_POLICY_FORMAL_YOU_LOWERCASE, MSG_RED_POLICY_TY_VY_PRONOUN } from "../rule-messages";
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

const TY_TO_VY_MESSAGE = MSG_RED_POLICY_TY_VY_PRONOUN;

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

const HORIZONTAL_WS = /[ \t\u00A0\u202F]/u;

/**
 * После этих слов «Вы» почти всегда продолжение фразы, а не новое предложение
 * без точки («если Вы хотите», не «если. Вы хотите»).
 */
const MID_SENTENCE_BEFORE_NOMINATIVE_VY = new Set([
  "если",
  "когда",
  "пока",
  "чтобы",
  "хотя",
  "разве",
  "будто",
  "словно",
  "что",
  "как",
  "чем",
  "куда",
  "откуда",
  "почему",
  "зачем",
  "или",
  "либо",
  "также",
  "тоже",
  "даже",
  "лишь",
  "только",
  "ведь",
  "однако",
  "поэтому",
  "потому",
  "значит",
  "тогда",
  "после",
  "перед",
  "между",
  "среди",
  "около",
  "возле",
  "против",
  "кроме",
  "через",
  "ради",
  "который",
  "которая",
  "которое",
  "которые",
  "которого",
  "которой",
  "которых",
]);

function wordBefore(text: string, index: number): string | null {
  let end = index;
  while (end > 0 && HORIZONTAL_WS.test(text[end - 1]!)) {
    end -= 1;
  }
  if (end === 0) return null;
  let start = end - 1;
  while (start >= 0 && /[а-яёa-zА-Яа-яЁёA-Za-z\-']/u.test(text[start]!)) {
    start -= 1;
  }
  const word = text.slice(start + 1, end);
  return word.length > 0 ? word : null;
}

/**
 * «…профиль Вы можете» похоже на новое предложение без точки.
 * Не понижаем «Вы», чтобы confirm-точка не потеряла заглавную.
 * «Вас/Ваш/Вам» и «если Вы» оставляем auto-строчными.
 */
function isNominativeVyLikelyNewSentence(text: string, match: RegExpExecArray): boolean {
  const prefix = match[1] ?? "";
  const word = match[2] ?? "";
  if (word !== "Вы") return false;

  const wordStart = match.index + prefix.length;
  let wsStart = wordStart;
  while (wsStart > 0 && HORIZONTAL_WS.test(text[wsStart - 1]!)) {
    wsStart -= 1;
  }
  if (wsStart === wordStart) return false;
  if (!findImplicitSentenceBoundaryIndices(text).includes(wsStart)) return false;

  const prev = wordBefore(text, wsStart);
  if (prev && MID_SENTENCE_BEFORE_NOMINATIVE_VY.has(prev.toLowerCase())) {
    return false;
  }
  return true;
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
      message: MSG_RED_POLICY_FORMAL_YOU_LOWERCASE,
      priority: 58,
      matchFilter: (text, match) => !isNominativeVyLikelyNewSentence(text, match),
    }),
  ]);
}
