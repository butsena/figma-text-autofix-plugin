import type { AutofixRule } from "../../core/autofix-engine";
import { APPLY_POLICY_CONFIRM } from "../../core/apply-policy";
import { rule, rules } from "../../core/rule-def";
import { MSG_RED_POLICY_SENTENCE_CAP } from "../rule-messages";
import { HORIZONTAL_SPACE, LINE_BREAK } from "./constants";

const LOWERCASE_LETTER = String.raw`[a-zа-яё]`;

/** Пробелы и открывающие знаки перед первой буквой предложения. */
const PREFIX_BEFORE_FIRST_LETTER = String.raw`(?:${HORIZONTAL_SPACE}|[«"''(\[—–])*`;

const LIST_BULLET = String.raw`[•·*\-–—]`;
/** Не трогаем только маркированные списки: • пункт, - пункт. */
const NOT_BULLET_LIST_ITEM_START = String.raw`(?!${HORIZONTAL_SPACE}*${LIST_BULLET}${HORIZONTAL_SPACE}+)`;

/** Не трогаем локальную часть email перед @. */
const NOT_EMAIL_LOCAL_START = String.raw`(?![a-z0-9._+\-]*@)`;

/**
 * Маркер нумерованного пункта. Без lookbehind — в sandbox Figma сложные
 * lookbehind с переменной длиной могут не срабатывать / ронять RegExp.
 *
 * Голова: начало / перевод строки / «:» / слово ≥4 букв + пробел (мягкий перенос).
 * Не ловит «см. 1. пункт» (короткое сокращение перед номером).
 */
const NUMBERED_LIST_HEAD = String.raw`(?:^|${LINE_BREAK}|[:：]|[A-Za-zА-Яа-яЁё]{4,}${HORIZONTAL_SPACE}+)`;
/** Точка списка: обычная, fullwidth, one-dot leader. */
const LIST_DOT = String.raw`[.)\uFF0E\u2024]`;
const NUMBERED_LIST_MARKER = String.raw`${HORIZONTAL_SPACE}*\d+${LIST_DOT}${HORIZONTAL_SPACE}*`;

/**
 * Начало предложения без lookbehind (Figma-safe):
 * — начало текста;
 * — после . ! ? …; точка не после цифры и не перед доменом (example.com).
 */
const SENTENCE_BOUNDARY_HEAD = String.raw`(?:^|(?:[^0-9\r\n]\.(?![a-z0-9]))|(?:[!?…]))`;

function capitalizeLetter(char: string): string {
  if (char.toLowerCase() === "ё") return "Ё";
  return char.toUpperCase();
}

export function buildSentenceCapitalizationRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-138-numbered-list-capitalize",
      category: "typography",
      pattern: new RegExp(
        `(${NUMBERED_LIST_HEAD})(${NUMBERED_LIST_MARKER})(${PREFIX_BEFORE_FIRST_LETTER})(${LOWERCASE_LETTER})${NOT_EMAIL_LOCAL_START}`,
        "gu",
      ),
      replacement: (_match, head, marker, prefix, letter) =>
        `${head}${marker}${prefix}${capitalizeLetter(letter)}`,
      message: MSG_RED_POLICY_SENTENCE_CAP,
      priority: 91,
      applyPolicy: APPLY_POLICY_CONFIRM,
    }),
    rule({
      id: "cian-138-sentence-start-capitalize",
      category: "typography",
      pattern: new RegExp(
        `(${SENTENCE_BOUNDARY_HEAD})${NOT_BULLET_LIST_ITEM_START}(${PREFIX_BEFORE_FIRST_LETTER})(${LOWERCASE_LETTER})${NOT_EMAIL_LOCAL_START}`,
        "gu",
      ),
      replacement: (_match, head, prefix, letter) =>
        `${head}${prefix}${capitalizeLetter(letter)}`,
      message: MSG_RED_POLICY_SENTENCE_CAP,
      priority: 90,
      applyPolicy: APPLY_POLICY_CONFIRM,
    }),
  ]);
}
