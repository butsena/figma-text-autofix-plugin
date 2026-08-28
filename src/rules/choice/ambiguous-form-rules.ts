import type { AutofixRule } from "../../core/autofix-engine";
import { APPLY_POLICY_CHOICE } from "../../core/apply-policy";
import { rule, rules } from "../../core/rule-def";
import { CYRILLIC_LETTERS, escapeRegex } from "../regex";
import {
  MSG_CHOICE_ISHCHITE_ISHCHETE,
  MSG_CHOICE_VSE_VSYO,
  MSG_CHOICE_VSE_VSYO_HINT,
} from "../rule-messages";

const HINT_HTML_ISHCHITE_ISHCHETE = `
  <div class="reportHint">
    <div class="reportHintTitle">Подсказка:</div>
    <ul class="reportHintList">
      <li>что делаете? <span class="reportHintSep">|</span> ищете квартиру целую вечность</li>
      <li>что делайте? <span class="reportHintSep">|</span> повелеваю: ищите квартиру только на Циане!</li>
    </ul>
  </div>`;

export type AmbiguousFormChoice = {
  id: string;
  options: [string, string];
  message: string;
  hint?: string;
  hintHtml?: string;
  allowSkip?: boolean;
};

/** Пары равноправных форм: плагин просит выбрать, а не «исправить». */
export const AMBIGUOUS_FORM_CHOICES: AmbiguousFormChoice[] = [
  {
    id: "cian-choice-ishchite-ishchete",
    options: ["ищите", "ищете"],
    message: MSG_CHOICE_ISHCHITE_ISHCHETE,
    hintHtml: HINT_HTML_ISHCHITE_ISHCHETE,
    allowSkip: false,
  },
  {
    id: "cian-choice-vse-vsyo",
    options: ["все", "всё"],
    message: MSG_CHOICE_VSE_VSYO,
    hint: MSG_CHOICE_VSE_VSYO_HINT,
    allowSkip: false,
  },
];

const CHOICE_BY_ID = new Map(AMBIGUOUS_FORM_CHOICES.map((choice) => [choice.id, choice]));

export function getAmbiguousFormChoice(ruleId: string): AmbiguousFormChoice | undefined {
  return CHOICE_BY_ID.get(ruleId);
}

export function isChoiceRuleWithoutSkip(ruleId: string): boolean {
  const choice = getAmbiguousFormChoice(ruleId);
  return choice != null && choice.allowSkip === false;
}

function wordCaseVariants(word: string): string[] {
  const lower = word.toLowerCase();
  const title = lower.charAt(0).toUpperCase() + lower.slice(1);
  const upper = lower.toUpperCase();
  return [...new Set([lower, title, upper])];
}

function choiceAlternation(options: string[]): string {
  return options.flatMap(wordCaseVariants).map(escapeRegex).join("|");
}

export function buildAmbiguousFormChoiceRules(
  choices: AmbiguousFormChoice[] = AMBIGUOUS_FORM_CHOICES,
): AutofixRule[] {
  return rules(
    choices.map(({ id, options, message, hint, hintHtml }) =>
      rule({
        id,
        category: "form_choice",
        pattern: new RegExp(
          `(?<![${CYRILLIC_LETTERS}])(?:${choiceAlternation(options)})(?![${CYRILLIC_LETTERS}])`,
          "gu",
        ),
        replacement: (match) => match,
        message,
        ...(hint ? { hint } : {}),
        ...(hintHtml ? { hintHtml } : {}),
        choiceOptions: options,
        priority: 78,
        applyPolicy: APPLY_POLICY_CHOICE,
      }),
    ),
  );
}
