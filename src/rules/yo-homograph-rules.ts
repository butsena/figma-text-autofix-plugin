import type { AutofixRule } from "../core/autofix-engine";
import { APPLY_POLICY_CONFIRM } from "../core/apply-policy";
import { rule, rules } from "../core/rule-def";
import { cyrillicWholeWordPattern, escapeRegex } from "./regex";
import { capitalizeLike } from "../shared/case";
import { msgConfirmYoHomograph } from "./rule-messages";
import yoHomographsRaw from "../../data/yo-homographs.txt?raw";

export type YoHomographPair = {
  eForm: string;
  yoForm: string;
};

export function parseYoHomographPairs(raw: string): YoHomographPair[] {
  return raw
    .split(/\n/)
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const [eForm, yoForm] = line.split(/\s+/);
      if (!eForm || !yoForm) {
        throw new Error(`Неверная строка yo-homographs: ${line}`);
      }
      return { eForm, yoForm };
    });
}

function eFormVariants(eForm: string): string[] {
  const lower = eForm.toLowerCase();
  const title = lower.charAt(0).toUpperCase() + lower.slice(1);
  const upper = lower.toUpperCase();
  return [...new Set([lower, title, upper])];
}

export function buildYoHomographRulesFromPairs(pairs: YoHomographPair[]): AutofixRule[] {
  return rules(
    pairs.flatMap(({ eForm, yoForm }) => {
      const alternation = eFormVariants(eForm).map(escapeRegex).join("|");
      return [
        rule({
          id: `cian-yo-homograph-${eForm.toLowerCase()}`,
          category: "yo_spelling",
          pattern: cyrillicWholeWordPattern(alternation),
          replacement: (_match, prefix, word) => `${prefix}${capitalizeLike(word, yoForm)}`,
          message: msgConfirmYoHomograph(eForm, yoForm),
          priority: 77,
          applyPolicy: APPLY_POLICY_CONFIRM,
        }),
      ];
    }),
  );
}

export function buildYoHomographRules(): AutofixRule[] {
  return buildYoHomographRulesFromPairs(parseYoHomographPairs(yoHomographsRaw));
}
