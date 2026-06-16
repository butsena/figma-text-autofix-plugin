import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import { MSG_NORMALIZE_PHONE } from "../rule-messages";
import { NBSP } from "./constants";

function formatRuPhoneToCianStandard(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return raw;
  if (digits[0] !== "7" && digits[0] !== "8") return raw;

  const local = digits.slice(1);
  const part1 = local.slice(0, 3);
  const part2 = local.slice(3, 6);
  const part3 = local.slice(6, 8);
  const part4 = local.slice(8, 10);
  return `+7${NBSP}${part1}${NBSP}${part2}-${part3}-${part4}`;
}

export function buildPhoneRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-100-phone-ru-standard",
      category: "phone_formatting",
      pattern: /(^|[^0-9+])((?:\+7|8)[0-9\s\u00A0\u202F()\-–—]{8,25}[0-9])(?=[^0-9]|$)/g,
      replacement: (_match, prefix, phoneRaw) => `${prefix}${formatRuPhoneToCianStandard(phoneRaw)}`,
      message: MSG_NORMALIZE_PHONE,
      priority: 55,
    }),
  ]);
}
