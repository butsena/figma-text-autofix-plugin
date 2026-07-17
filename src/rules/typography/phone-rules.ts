import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import { MSG_NORMALIZE_PHONE } from "../rule-messages";
import { NBSP } from "./constants";

/** Российский номер: +7, 8 или 7 в начале, далее цифры и типографские разделители. */
const RU_PHONE_PREFIX = String.raw`\+?(?:7|8)`;
const RU_PHONE_BODY = String.raw`[0-9\s\u00A0\u202F()\-–—]{8,25}[0-9]`;
const RU_PHONE_PATTERN = new RegExp(
  `(^|[^0-9+])(${RU_PHONE_PREFIX}${RU_PHONE_BODY})(?=[^0-9]|$)`,
  "g",
);

/** Полный формат Циан: +7 999 999-99-99. */
export function formatRuPhoneToCianStandard(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && (digits[0] === "7" || digits[0] === "8")) {
    const local = digits.slice(1);
    const part1 = local.slice(0, 3);
    const part2 = local.slice(3, 6);
    const part3 = local.slice(6, 8);
    const part4 = local.slice(8, 10);
    return `+7${NBSP}${part1}${NBSP}${part2}-${part3}-${part4}`;
  }

  // Неполный номер: всё равно 8 (или +8) → +7 в начале.
  if (/^\+?8/.test(raw)) {
    return raw.replace(/^\+?8/, "+7");
  }

  // 7 без плюса в начале → +7 (если похоже на номер, а не случайная цифра).
  if (/^7/.test(raw) && digits.length >= 10) {
    return raw.replace(/^7/, "+7");
  }

  return raw;
}

export function buildPhoneRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-100-phone-ru-standard",
      category: "phone_formatting",
      pattern: RU_PHONE_PATTERN,
      replacement: (_match, prefix, phoneRaw) => `${prefix}${formatRuPhoneToCianStandard(phoneRaw)}`,
      message: MSG_NORMALIZE_PHONE,
      priority: 55,
    }),
  ]);
}
