import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import { MSG_BRAND_UPPERCASE } from "../rule-messages";
import { CYRILLIC_WORD_EDGE, CYRILLIC_WORD_EDGE_END } from "../regex";

export function buildCianBrandRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-001-cian-brand-uppercase",
      category: "cian_branding",
      /** Только ВЕРХНИЙ регистр (без флага i): «Циане» уже верно и не должно попадать под правило. */
      pattern: new RegExp(`${CYRILLIC_WORD_EDGE}(ЦИАН(?:[Ее]|(А|У|ОМ))?)${CYRILLIC_WORD_EDGE_END}`, "g"),
      replacement: (_match, prefix, word, suffix?: string) => {
        if (/^Циан(?:е|а|у|ом)?$/.test(word)) return `${prefix}${word}`;
        if (/ЦИАН[Ее]$/.test(word)) return `${prefix}Циане`;
        const s = suffix ? String(suffix).toLowerCase() : "";
        return `${prefix}Циан${s}`;
      },
      message: MSG_BRAND_UPPERCASE,
      priority: 100,
    }),
  ]);
}
