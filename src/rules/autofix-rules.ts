import type { AutofixRule } from "../core/autofix-engine";
import { getSheetReplacementRules } from "../sheet/replacement-rules-store";
import { buildCianBrandRules } from "./cian/brand-rules";
import { buildFormalPronounRules } from "./cian/formal-pronoun-rules";
import { buildFormalVerbRules } from "./cian/formal-verb-rules";
import { buildSmsRules } from "./cian/sms-rules";
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
import { buildSentenceCapitalizationRules } from "./typography/sentence-capitalization-rules";
import { buildSentenceTerminalPeriodRules } from "./typography/sentence-terminal-period-rules";
import { buildServiceWordNbspRules } from "./typography/service-word-nbsp-rules";

function composeAutofixRules(): AutofixRule[] {
  return [
    ...buildCianBrandRules(),
    ...buildFormalPronounRules(),
    ...buildFormalVerbRules(),
    ...buildSmsRules(),
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
    ...buildSentenceCapitalizationRules(),
    ...buildSentenceTerminalPeriodRules(),
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
