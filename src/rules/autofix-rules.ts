import type { AutofixRule } from "../core/autofix-engine";
import { getSheetReplacementRules } from "../sheet/replacement-rules-store";
import { buildCianBrandRules } from "./cian/brand-rules";
import { buildFormalPronounRules } from "./cian/formal-pronoun-rules";
import {
  buildCianNounOrNetDeclensionRule,
  buildCianPrepositionDeclensionRules,
} from "./cian/prep-declension-table";
import { buildEYoRules } from "./e-yo-rules";
import { buildEmailRules } from "./formatting/email-rules";
import { buildGeneralTypographyRules } from "./typography/general-typography-rules";
import { buildHyphenCompoundRules } from "./typography/hyphen-compound-rules";
import { buildNumberGroupingRules } from "./typography/number-grouping";
import { buildNbspBindingRules } from "./typography/nbsp-binding-rules";
import { buildPunctuationSpacingRules } from "./typography/punctuation-spacing-rules";
import { buildServiceWordNbspRules } from "./typography/service-word-nbsp-rules";

function composeAutofixRules(): AutofixRule[] {
  return [
    ...buildCianBrandRules(),
    ...buildFormalPronounRules(),
    ...buildCianPrepositionDeclensionRules(),
    buildCianNounOrNetDeclensionRule(),
    ...buildEmailRules(),
    ...buildEYoRules(),
    ...getSheetReplacementRules(),
    ...buildServiceWordNbspRules(),
    ...buildNbspBindingRules(),
    ...buildNumberGroupingRules(),
    ...buildGeneralTypographyRules(),
    ...buildHyphenCompoundRules(),
    ...buildPunctuationSpacingRules(),
  ];
}

let autofixRulesCache: AutofixRule[] | null = null;

export function getAutofixRules(): AutofixRule[] {
  if (!autofixRulesCache) autofixRulesCache = composeAutofixRules();
  return autofixRulesCache;
}

/** Сбросить кэш после смены табличных правил (например, после загрузки CSV по сети). */
export function invalidateAutofixRulesCache(): void {
  autofixRulesCache = null;
}
