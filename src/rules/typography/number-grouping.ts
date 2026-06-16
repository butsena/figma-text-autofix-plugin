import type { AutofixRule } from "../../core/autofix-engine";
import { rule } from "../../core/rule-def";
import { MSG_TYPO_NBSP_NUMBER } from "../rule-messages";
import { NBSP } from "./constants";

const GROUP_SEP = NBSP;

/** Уже сгруппировано по разрядам (пробел или NBSP между частями). */
function isAlreadyGrouped(num: string): boolean {
  if (!/[ \u00A0\u202F]/.test(num)) return false;
  const parts = num.split(/[ \u00A0\u202F]+/);
  if (parts.length < 2) return false;
  if (parts.some((p) => !/^\d+$/.test(p))) return false;
  return parts.slice(1).every((p) => p.length === 3);
}

/** «100 000» / «1 000 000» с обычными пробелами между разрядами. */
const GROUPED_WITH_REGULAR_SPACE =
  /(^|[^0-9])((?:\d{1,3})(?: \d{3})+)([.,]\d+)?(?=[^0-9]|$)/g;

/** 11 цифр с 7/8 в начале — мобильный РФ, не трогаем (отдельное правило телефона). */
function isLikelyRuMobileDigits(digits: string): boolean {
  return digits.length === 11 && (digits[0] === "7" || digits[0] === "8");
}

/** Группы по 3 цифры справа: 100000 → 100 000. */
export function formatThousands(digits: string, sep = GROUP_SEP): string {
  const firstLen = digits.length % 3 || 3;
  const parts = [digits.slice(0, firstLen)];
  for (let i = firstLen; i < digits.length; i += 3) {
    parts.push(digits.slice(i, i + 3));
  }
  return parts.join(sep);
}

export function buildNumberGroupingRules(): AutofixRule[] {
  return [
    rule({
      id: "cian-135-nbsp-within-grouped-numbers",
      category: "numeric_formatting",
      pattern: GROUPED_WITH_REGULAR_SPACE,
      replacement: (_match, prefix, intPart, fracPart?: string) => {
        const normalized = intPart.replace(/ +/g, NBSP);
        return `${prefix}${normalized}${fracPart ?? ""}`;
      },
      message: MSG_TYPO_NBSP_NUMBER,
      priority: 51,
    }),
    rule({
      id: "cian-130-thousands-grouping",
      category: "numeric_formatting",
      // Целая часть 5+ цифр подряд; дробная ,12 / .5 — не трогаем
      pattern: /(^|[^0-9])(\d{5,})([.,]\d+)?(?=[^0-9]|$)/g,
      replacement: (match, prefix, intPart, fracPart?: string) => {
        if (prefix.endsWith("+")) return match;
        if (isAlreadyGrouped(intPart)) return match;
        if (isLikelyRuMobileDigits(intPart)) return match;
        return `${prefix}${formatThousands(intPart)}${fracPart ?? ""}`;
      },
      message: MSG_TYPO_NBSP_NUMBER,
      priority: 52,
    }),
  ];
}
