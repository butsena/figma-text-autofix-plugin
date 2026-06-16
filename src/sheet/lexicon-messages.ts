import { msgLexiconReplace } from "../rules/rule-messages";

type LexiconGroup = {
  message: string;
  match: (variants: string[], replace: string) => boolean;
};

const LEXICON_GROUPS: LexiconGroup[] = [
  {
    message: "Редполитика: «далее» → «дальше».",
    match: (variants, replace) =>
      variants.some((v) => /^далее$/i.test(v.trim())) || replace.toLowerCase() === "дальше",
  },
  {
    message: "Редполитика: «онлайн» — слитно.",
    match: (variants, replace) =>
      variants.some((v) => /он[\s-]?лайн/i.test(v)) || replace.toLowerCase() === "онлайн",
  },
  {
    message: "Редполитика: «приобрести» → «купить».",
    match: (variants, replace) =>
      variants.some((v) => /приобр/i.test(v)) || /^куп/i.test(replace),
  },
  {
    message: "Редполитика: «денежные средства» → «деньги».",
    match: (variants) => variants.some((v) => /денежн/i.test(v) && /средств/i.test(v)),
  },
  {
    message: "Редполитика: «первоначальный взнос» → «первый взнос».",
    match: (variants) => variants.some((v) => /первоначальн/i.test(v) && /взнос/i.test(v)),
  },
  {
    message: "Редполитика: «промокод» — слитно.",
    match: (variants, replace) =>
      variants.some((v) => /промо[\s-]?код/i.test(v)) || /промокод/i.test(replace),
  },
  {
    message: "Редполитика: «риэлтор» → «риелтор».",
    match: (variants) => variants.some((v) => /риэлтор/i.test(v)),
  },
  {
    message: "Редполитика: «кешбэк» — единое написание.",
    match: (variants) => variants.some((v) => /к[еэ]шб[еэ]к/i.test(v)),
  },
];

/** Групповой комментарий для строк лексикона; для неизвестных пар — по одной замене. */
export function resolveLexiconMessage(variants: string[], replace: string): string {
  for (const group of LEXICON_GROUPS) {
    if (group.match(variants, replace)) return group.message;
  }
  return msgLexiconReplace(variants, replace);
}
