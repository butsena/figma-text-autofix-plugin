import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import { LATIN_CYRILLIC_LETTERS } from "../regex";
import { HORIZONTAL_SPACE, NBSP } from "./constants";

/** Буквы и цифры по краям — признак слитной конструкции (дефис), не оборотного тире. */
const COMPOUND_EDGE = `${LATIN_CYRILLIC_LETTERS}0-9`;

/** Длинное тире, короткое тире, знак минуса — не дефис в «из—за», «2−комнатная». */
const NON_HYPHEN_DASH = "[—–−]";

/** Любой типографский/ASCII разделитель в диапазоне. */
const RANGE_DASH = "[-—–−]";

/** 5, 1000, 2024 — без пробелов внутри. */
const PLAIN_INTEGER = String.raw`\d+`;

/** 5 000, 1 000 000 — группы ровно по три цифры. */
const GROUPED_THOUSANDS = String.raw`\d{1,3}(?:${HORIZONTAL_SPACE}\d{3})+`;

const RANGE_INTEGER = `(?:${GROUPED_THOUSANDS}|${PLAIN_INTEGER})`;

const EN_DASH = "–";

function formatNumericRangePart(raw: string): string {
  return raw.trim().replace(/ +/g, NBSP);
}

const NUMERIC_RANGE_ENDASH_RE = new RegExp(
  [
    `(?:${RANGE_INTEGER})${HORIZONTAL_SPACE}+${RANGE_DASH}${HORIZONTAL_SPACE}+(?:${RANGE_INTEGER})`,
    `(?<![0-9])(?<!\\d${RANGE_DASH})${PLAIN_INTEGER}${RANGE_DASH}${PLAIN_INTEGER}(?![0-9])(?!${RANGE_DASH}\\d)`,
  ].join("|"),
  "g",
);

/**
 * Зеркало cian-117: там «слово - слово» → длинное тире с пробелами;
 * здесь «слово—слово» без пробелов → дефис (сложные слова, приставки).
 * Числовые диапазоны — отдельное правило cian-137.
 */
export function buildHyphenCompoundRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-137-numeric-range-endash",
      category: "punctuation_typography",
      pattern: NUMERIC_RANGE_ENDASH_RE,
      replacement: (match: string) => {
        const nums = match.match(/\d[\d \u00A0\u202F]*/g);
        if (!nums || nums.length < 2) return match;
        const left = formatNumericRangePart(nums[0]);
        const right = formatNumericRangePart(nums[1]);
        return `${left}${NBSP}${EN_DASH}${NBSP}${right}`;
      },
      message:
        "Типографика: в числовом диапазоне — короткое тире с неразрывными пробелами (5 – 10).",
      priority: 59,
    }),
    rule({
      id: "cian-136-compound-dash-to-hyphen",
      category: "punctuation_typography",
      pattern: new RegExp(
        `(?:[${LATIN_CYRILLIC_LETTERS}]${NON_HYPHEN_DASH}[${COMPOUND_EDGE}]|[${COMPOUND_EDGE}]${NON_HYPHEN_DASH}[${LATIN_CYRILLIC_LETTERS}])`,
        "g",
      ),
      replacement: (match) => match.replace(/[—–−]/g, "-"),
      message:
        "Типографика: в слитных конструкциях (без пробелов) длинное тире/минус заменить на дефис.",
      priority: 58,
    }),
  ]);
}
