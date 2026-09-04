import type { AutofixRule } from "../../core/autofix-engine";
import { APPLY_POLICY_CHOICE } from "../../core/apply-policy";
import { rule, rules } from "../../core/rule-def";
import { CYRILLIC_LETTERS, escapeRegex } from "../regex";
import type { AmbiguousFormChoice } from "../../lexicon/ambiguous-form-choices-parse";
import {
  getAmbiguousFormChoice,
  getAmbiguousFormChoices,
} from "../../lexicon/ambiguous-form-choices-store";

export type { AmbiguousFormChoice };

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
  choices: readonly AmbiguousFormChoice[] = getAmbiguousFormChoices(),
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
