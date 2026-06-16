import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import {
  HORIZONTAL_SPACE,
  LINE_BREAK,
  SENTENCE_END_PERIOD,
} from "./constants";

const LOWERCASE_LETTER = String.raw`[a-zа-яё]`;

/** Пробелы и открывающие знаки перед первой буквой предложения. */
const PREFIX_BEFORE_FIRST_LETTER = String.raw`(?:${HORIZONTAL_SPACE}|[«"''(\[—–])*`;

const LIST_BULLET = String.raw`[•·*\-–—]`;
/** Не трогаем только маркированные списки: • пункт, - пункт. */
const NOT_BULLET_LIST_ITEM_START = String.raw`(?!${HORIZONTAL_SPACE}*${LIST_BULLET}${HORIZONTAL_SPACE}+)`;

/** Не трогаем локальную часть email перед @. */
const NOT_EMAIL_LOCAL_START = String.raw`(?![a-z0-9._+\-]*@)`;

/** Нумерованный пункт списка — начало «предложения» внутри пункта (в т.ч. после переноса строки). */
const NUMBERED_LIST_ITEM_PREFIX = String.raw`^${HORIZONTAL_SPACE}*\d+[.)]${HORIZONTAL_SPACE}*|${LINE_BREAK}${HORIZONTAL_SPACE}*\d+[.)]${HORIZONTAL_SPACE}*`;

const CAPITALIZE_SENTENCE_START_LOOKBEHIND = String.raw`(?<=${NUMBERED_LIST_ITEM_PREFIX}|^|${SENTENCE_END_PERIOD}|[!?…]${HORIZONTAL_SPACE}*)`;

function capitalizeLetter(char: string): string {
  if (char.toLowerCase() === "ё") return "Ё";
  return char.toUpperCase();
}

export function buildSentenceCapitalizationRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-138-sentence-start-capitalize",
      category: "typography",
      pattern: new RegExp(
        `${CAPITALIZE_SENTENCE_START_LOOKBEHIND}${NOT_BULLET_LIST_ITEM_START}(${PREFIX_BEFORE_FIRST_LETTER})(${LOWERCASE_LETTER})${NOT_EMAIL_LOCAL_START}`,
        "gu",
      ),
      replacement: (_match, prefix, letter) => `${prefix}${capitalizeLetter(letter)}`,
      message: "Типографика: первая буква предложения — с заглавной.",
      priority: 90,
    }),
  ]);
}
