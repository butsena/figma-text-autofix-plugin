import type { TextFix } from "../core/autofix-engine";
import { APPLY_POLICY_CONFIRM } from "../core/apply-policy";
import { MSG_NE_VERB_SEPARATE } from "../rules/rule-messages";
import { rangesOverlap } from "../shared/ranges-overlap";
import { extractCyrillicWordTokens } from "./tokenize-cyrillic-words";

export const NE_VERB_SPLIT_RULE_ID = "orthography-ne-verb-split";
export const NE_VERB_SPLIT_PRIORITY = 71;

/** Минимальная длина хвоста после «не» — короткие «неси»/«несу» не трогаем. */
export const NE_VERB_MIN_TAIL = 4;

const NE_PREFIX = "не";

/** Причастия: не «не работающий». Род и число тех же суффиксов тоже. */
const PARTICIPLE_ENDING =
  /(?:щий|щая|щее|щие|вший|вшая|вшее|вшие|нный|нная|нное|нные)$/iu;

/**
 * Инфинитив и личные формы, без коротких -ут/-ет: иначе «маршрут» и «канал»
 * выглядят как глагол. «йтесь» — императив мн.ч. («бойтесь», «смейтесь»).
 * Подтверждение, не auto — редкий ложный хвост можно пропустить.
 */
const VERB_ENDING =
  /(?:иться|аться|яться|еться|ыться|оться|уться|чься|ить|ать|ять|еть|ыть|оть|уть|чь|ешься|ёшься|ишься|етесь|ётесь|итесь|утся|ются|атся|ятся|емся|ёмся|имся|ется|ётся|ится|ешь|ёшь|ишь|ете|ёте|ите|йтесь|йте|ьте|йся|ись|лась|лось|лись|ила|ала|яла|ела|ыла|ило|ало|яло|ело|или|али|яли|ели)$/iu;

export type NeVerbKnownCheck = (candidate: string) => boolean;

export type BuildNeVerbFixesOptions = {
  skipWord?: (word: string) => boolean;
  occupied?: readonly { from: number; to: number }[];
};

function hasNePrefix(lowerWord: string): boolean {
  return lowerWord.startsWith(NE_PREFIX);
}

export function isParticipleTail(tailLower: string): boolean {
  return PARTICIPLE_ENDING.test(tailLower);
}

export function looksLikeVerbTail(tailLower: string): boolean {
  return VERB_ENDING.test(tailLower);
}

/** Сохраняет регистр исходных кусков: «НЕ» + «ОТКЛЮЧИТЕ», «Не» + «отключите». */
export function joinNeWithTail(word: string): string {
  return `${word.slice(0, NE_PREFIX.length)} ${word.slice(NE_PREFIX.length)}`;
}

/**
 * «неотключите» → «не отключите», если целиком слова нет в Hunspell,
 * а хвост — известный инфинитив или личная форма, не причастие.
 */
export function separateNeVerb(word: string, isKnown: NeVerbKnownCheck): string | null {
  if (word.length < NE_PREFIX.length + NE_VERB_MIN_TAIL) return null;

  const lower = word.toLowerCase();
  if (!hasNePrefix(lower)) return null;

  const tailLower = lower.slice(NE_PREFIX.length);
  if (tailLower.length < NE_VERB_MIN_TAIL) return null;
  if (isParticipleTail(tailLower)) return null;
  if (!looksLikeVerbTail(tailLower)) return null;
  if (isKnown(word)) return null;

  const tail = word.slice(NE_PREFIX.length);
  if (!isKnown(tail)) return null;

  return joinNeWithTail(word);
}

export function buildNeVerbFixes(
  text: string,
  isKnown: NeVerbKnownCheck,
  options: BuildNeVerbFixesOptions = {},
): TextFix[] {
  const skipWord = options.skipWord;
  const occupied = options.occupied ?? [];
  const fixes: TextFix[] = [];

  for (const token of extractCyrillicWordTokens(text)) {
    const { word, from, to } = token;
    if (skipWord?.(word)) continue;
    if (occupied.some((range) => rangesOverlap(from, to, range.from, range.to))) continue;
    if (fixes.some((fix) => rangesOverlap(from, to, fix.from, fix.to))) continue;

    const after = separateNeVerb(word, isKnown);
    if (!after || after === word) continue;

    fixes.push({
      from,
      to,
      before: word,
      after,
      ruleId: NE_VERB_SPLIT_RULE_ID,
      category: "cian_editorial",
      message: MSG_NE_VERB_SEPARATE,
      priority: NE_VERB_SPLIT_PRIORITY,
      applyPolicy: APPLY_POLICY_CONFIRM,
    });
  }

  return fixes;
}
