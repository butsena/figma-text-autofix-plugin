import type { AutofixRule } from "../../core/autofix-engine";
import {
  MSG_BRAND_NOUN_OR_NET,
  MSG_BRAND_PREP_DECLENSION,
} from "../rule-messages";
import { CYRILLIC_LETTERS, escapeRegex } from "../regex";

type CianPrepReclinationRow = {
  id: string;
  caseRu: string;
  target: string;
  preps: readonly string[];
  priority?: number;
};

function prepRegexVariants(prep: string): string[] {
  const trimmed = prep.trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();
  const capped = lower.charAt(0).toUpperCase() + lower.slice(1);
  if (trimmed === lower && lower !== capped) return [escapeRegex(lower), escapeRegex(capped)];
  return [escapeRegex(trimmed)];
}

function buildPrepAlternation(preps: readonly string[]): string {
  const parts = Array.from(new Set(preps.flatMap(prepRegexVariants))).sort((a, b) => b.length - a.length);
  return parts.join("|");
}

/**
 * Таблица управления для «Циан» в типичных конструкциях интерфейса.
 * Политика: **в / во / на** → предложный; **про / через** → винительный «Циан».
 */
const CIAN_PREP_RECTION_TABLE: readonly CianPrepReclinationRow[] = [
  {
    id: "acc",
    caseRu: "винительный",
    target: "Циан",
    preps: ["про", "через", "сквозь", "поверх"],
    priority: 98,
  },
  {
    id: "gen",
    caseRu: "родительный",
    target: "Циана",
    preps: [
      "для",
      "без",
      "у",
      "от",
      "до",
      "после",
      "из",
      "около",
      "вокруг",
      "вместо",
      "вне",
      "внутри",
      "из-за",
      "из-под",
      "кроме",
      "взамен",
      "вследствие",
      "ради",
      "мимо",
      "возле",
      "впереди",
      "вроде",
      "насчёт",
      "насчет",
      "относительно",
    ],
  },
  {
    id: "dat",
    caseRu: "дательный",
    target: "Циану",
    preps: ["к", "ко", "по", "благодаря", "вопреки", "согласно"],
  },
  {
    id: "prep",
    caseRu: "предложный",
    target: "Циане",
    preps: ["в", "во", "на", "о", "об", "обо", "при"],
  },
  {
    id: "instr",
    caseRu: "творительный",
    target: "Цианом",
    preps: ["с", "со", "за", "перед", "передо", "над", "под", "подо", "меж", "между"],
  },
];

const CIAN_TAIL = String.raw`([«"]?)Циан(?![аеуомАЕУОМ])([»"]?)(?=[\s\.,:;!?)]|$)`;

/** Предлог — отдельное слово (иначе «о» срабатывает внутри «про»). */
const PREP_WORD_LOOKBEHIND = String.raw`(?<=^|[^${CYRILLIC_LETTERS}])`;

const ALL_CIAN_PREPS_ALTERNATION = buildPrepAlternation(
  CIAN_PREP_RECTION_TABLE.flatMap((row) => row.preps),
);

const GENITIVE_GAP = String.raw`((?:(?!${PREP_WORD_LOOKBEHIND}(?:${ALL_CIAN_PREPS_ALTERNATION})\\s)\\S+\\s+)*?)`;

export function buildCianPrepositionDeclensionRules(): AutofixRule[] {
  return CIAN_PREP_RECTION_TABLE.map((row) => {
    const inner = buildPrepAlternation(row.preps);
    const allowWordsBetweenPrepAndCian = row.id === "gen";
    const gap = allowWordsBetweenPrepAndCian ? GENITIVE_GAP : "";
    const pattern = new RegExp(
      `((?:${PREP_WORD_LOOKBEHIND}(?:${inner}))\\s+)${gap}${CIAN_TAIL}`,
      "g",
    );
    return {
      id: `cian-003-prep-${row.id}`,
      category: "cian_declension_context",
      pattern,
      replacement: allowWordsBetweenPrepAndCian
        ? (_m: string, prefix: string, middle: string, openQuote?: string, closeQuote?: string) => {
            const oq = openQuote ? String(openQuote) : "";
            const cq = closeQuote ? String(closeQuote) : "";
            return `${prefix}${middle}${oq}${row.target}${cq}`;
          }
        : (_m: string, prefix: string, openQuote?: string, closeQuote?: string) => {
            const oq = openQuote ? String(openQuote) : "";
            const cq = closeQuote ? String(closeQuote) : "";
            return `${prefix}${oq}${row.target}${cq}`;
          },
      message: MSG_BRAND_PREP_DECLENSION,
      priority: row.priority ?? 95,
    };
  });
}

export function buildCianNounOrNetDeclensionRule(): AutofixRule {
  return {
    id: "cian-003-noun-or-net",
    category: "cian_declension_context",
    pattern: new RegExp(
      `(^|[^А-Яа-яЁё])((?:нет|сайт|страница|раздел|контакты|телефон|адрес|компания|платформа|сервис|приложение|проект|бренд|партнер|отзывы|новости|объявления|вакансии))\\s+${CIAN_TAIL}`,
      "g",
    ),
    replacement: (_m: string, lead: string, word: string, openQuote?: string, closeQuote?: string) => {
      const oq = openQuote ? String(openQuote) : "";
      const cq = closeQuote ? String(closeQuote) : "";
      return `${lead}${word} ${oq}Циана${cq}`;
    },
    message: MSG_BRAND_NOUN_OR_NET,
    priority: 95,
  };
}
