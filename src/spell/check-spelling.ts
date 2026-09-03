import type { TextFix } from "../core/autofix-engine";
import { capitalizeLike } from "../shared/case";
import {
  ORTHOGRAPHY_SPELL_PRIORITY,
  ORTHOGRAPHY_SPELL_RULE_ID,
  MSG_ORTHOGRAPHY_SPELL,
} from "../rules/orthography-spell-rules";
import {
  getSpellChecker,
  isKnownWord,
  suggestCorrection,
} from "./spell-checker";
import {
  extractCyrillicWordTokens,
  rangesOverlap,
  shouldSkipSpellToken,
} from "./tokenize-cyrillic-words";
import { getSpellWhitelistWords } from "./spell-word-list-store";

const whitelistLower = (): Set<string> => {
  return new Set(getSpellWhitelistWords().map((w) => w.toLowerCase()));
};

function isWhitelisted(word: string, whitelist: Set<string>): boolean {
  return whitelist.has(word.toLowerCase());
}

function overlapsExistingFix(from: number, to: number, fixes: readonly TextFix[]): boolean {
  return fixes.some((fix) => rangesOverlap(from, to, fix.from, fix.to));
}

/** Проверка орфографии Hunspell; возвращает confirm-правки без пересечения с уже найденными. */
export function checkSpellingFixes(text: string, existingFixes: readonly TextFix[] = []): TextFix[] {
  const spell = getSpellChecker();
  if (!spell) return [];

  const whitelist = whitelistLower();
  const fixes: TextFix[] = [];

  for (const token of extractCyrillicWordTokens(text)) {
    const { word, from, to } = token;
    if (shouldSkipSpellToken(word)) continue;
    if (isWhitelisted(word, whitelist)) continue;
    if (overlapsExistingFix(from, to, existingFixes)) continue;
    if (isKnownWord(spell, word)) continue;

    const suggestion = suggestCorrection(spell, word);
    if (!suggestion) continue;

    const after = capitalizeLike(word, suggestion);
    if (after === word) continue;

    fixes.push({
      from,
      to,
      before: word,
      after,
      ruleId: ORTHOGRAPHY_SPELL_RULE_ID,
      category: "orthography",
      message: MSG_ORTHOGRAPHY_SPELL,
      priority: ORTHOGRAPHY_SPELL_PRIORITY,
      applyPolicy: "confirm",
    });
  }

  return fixes;
}
