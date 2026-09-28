import type { AutofixRule } from "../../core/autofix-engine";
import { APPLY_POLICY_CHOICE } from "../../core/apply-policy";
import { rule, rules } from "../../core/rule-def";
import { MSG_CHOICE_TITLE_CASE_BOUNDARY } from "../rule-messages";
import { matchesBoundaryExceptionAt } from "./boundary-exception-match";
import {
  isInsideDoubleQuotes,
  isInsideGuillemets,
} from "./implicit-sentence-boundary-filters";

export const TITLE_CASE_PAIR_CHOICE_RULE_ID = "cian-choice-title-case-boundary";

/**
 * Два неоднозначных кейса → choice (точка | строчная):
 * 1) Title Case + Title Case («Пишите Ждите», «Кватира Обломе»);
 * 2) короткое строчное (1–3 буквы) + Title Case («в Избранное») —
 *    неявная точка после {4,} сюда не доходит (намеренно: «в Москве»).
 * После строчных ≥4 букв («по запросу Главное») остаётся confirm-точка.
 */
const TITLE_CASE_PAIR_RE = new RegExp(
  String.raw`(?<![A-Za-zА-Яа-яЁё])([А-ЯЁ][а-яё]+|[а-яё]{1,3})([ \t\u00A0\u202F]+)([А-ЯЁ][а-яё]+)(?![A-Za-zА-Яа-яЁё])`,
  "gu",
);

function lowercaseFirstLetter(word: string): string {
  if (word.charAt(0).toLowerCase() === "ё" || word.charAt(0) === "Ё") {
    return `ё${word.slice(1)}`;
  }
  return word.charAt(0).toLowerCase() + word.slice(1);
}

function titleCasePairOptions(match: RegExpExecArray): string[] | undefined {
  const word1 = match[1];
  const space = match[2];
  const word2 = match[3];
  if (!word1 || !space || !word2) return undefined;
  return [`${word1}. ${word2}`, `${word1}${space}${lowercaseFirstLetter(word2)}`];
}

function shouldSkipTitleCasePair(text: string, match: RegExpExecArray): boolean {
  const secondStart = match.index + (match[1]?.length ?? 0) + (match[2]?.length ?? 0);
  if (isInsideGuillemets(text, match.index) || isInsideDoubleQuotes(text, match.index)) {
    return true;
  }
  if (isInsideGuillemets(text, secondStart) || isInsideDoubleQuotes(text, secondStart)) {
    return true;
  }
  if (matchesBoundaryExceptionAt(text, match.index)) return true;
  if (matchesBoundaryExceptionAt(text, secondStart)) return true;
  return false;
}

export function buildTitleCasePairChoiceRules(): AutofixRule[] {
  return rules([
    rule({
      id: TITLE_CASE_PAIR_CHOICE_RULE_ID,
      category: "cian_editorial",
      pattern: TITLE_CASE_PAIR_RE,
      replacement: (matched) => matched,
      message: MSG_CHOICE_TITLE_CASE_BOUNDARY,
      choiceOptionsForMatch: titleCasePairOptions,
      matchFilter: (text, match) => !shouldSkipTitleCasePair(text, match),
      priority: 86,
      applyPolicy: APPLY_POLICY_CHOICE,
    }),
  ]);
}
