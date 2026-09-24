import type { TextFix } from "../core/autofix-engine";
import { SPELLCHECK_ENABLED } from "../config/feature-flags";
import { capitalizeLike } from "../shared/case";
import {
  ORTHOGRAPHY_LAYOUT_PRIORITY,
  ORTHOGRAPHY_LAYOUT_RULE_ID,
  ORTHOGRAPHY_SPELL_PRIORITY,
  ORTHOGRAPHY_SPELL_RULE_ID,
  orthographyLayoutMessage,
  orthographySpellMessage,
} from "../rules/orthography-spell-rules";
import {
  getSpellChecker,
  isKnownWord,
  suggestCorrection,
  type SpellChecker,
} from "./spell-checker";
import {
  convertEnLayoutToRu,
  casingForSuggestion,
  extractLatinLayoutTokens,
  extractMixedScriptTokens,
  isLikelyUrlOrEmailContext,
  looksLikeRuTypedInEnLayout,
  shouldSkipLatinLayoutToken,
  suggestMixedScriptRu,
  textHasCyrillic,
} from "./keyboard-layout";
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

function checkKeyboardLayoutFixes(
  text: string,
  spell: SpellChecker,
  whitelist: Set<string>,
  existingFixes: readonly TextFix[],
): TextFix[] {
  if (!textHasCyrillic(text)) return [];

  const fixes: TextFix[] = [];
  const known = (w: string) => isKnownWord(spell, w);

  for (const token of extractMixedScriptTokens(text)) {
    const { word, from, to } = token;
    if (isWhitelisted(word, whitelist)) continue;
    if (isLikelyUrlOrEmailContext(text, from, to)) continue;
    if (overlapsExistingFix(from, to, existingFixes)) continue;
    if (overlapsExistingFix(from, to, fixes)) continue;

    const suggested = suggestMixedScriptRu(word, known);
    if (!suggested || suggested === word) continue;

    fixes.push({
      from,
      to,
      before: word,
      after: casingForSuggestion(text, from, suggested),
      ruleId: ORTHOGRAPHY_LAYOUT_RULE_ID,
      category: "orthography",
      message: orthographyLayoutMessage(word),
      priority: ORTHOGRAPHY_LAYOUT_PRIORITY,
      applyPolicy: "confirm",
    });
  }

  for (const token of extractLatinLayoutTokens(text)) {
    const { word, from, to } = token;
    if (shouldSkipLatinLayoutToken(word)) continue;
    if (isWhitelisted(word, whitelist)) continue;
    if (isLikelyUrlOrEmailContext(text, from, to)) continue;
    if (overlapsExistingFix(from, to, existingFixes)) continue;
    if (overlapsExistingFix(from, to, fixes)) continue;

    const converted = convertEnLayoutToRu(word);
    if (!converted || converted === word) continue;
    if (![...converted].some((ch) => /[а-яё]/i.test(ch))) continue;

    const knownRu = isKnownWord(spell, converted);
    const suspiciousGibberish = looksLikeRuTypedInEnLayout(word);

    if (!knownRu && !suspiciousGibberish) continue;

    const after = knownRu
      ? casingForSuggestion(text, from, converted)
      : capitalizeLike(word, converted);

    fixes.push({
      from,
      to,
      before: word,
      after,
      ruleId: ORTHOGRAPHY_LAYOUT_RULE_ID,
      category: "orthography",
      message: orthographyLayoutMessage(word),
      priority: ORTHOGRAPHY_LAYOUT_PRIORITY,
      applyPolicy: "confirm",
    });
  }

  return fixes;
}

/** Проверка орфографии Hunspell; возвращает confirm-правки без пересечения с уже найденными. */
export function checkSpellingFixes(text: string, existingFixes: readonly TextFix[] = []): TextFix[] {
  if (!SPELLCHECK_ENABLED) return [];

  const spell = getSpellChecker();
  if (!spell) return [];

  const whitelist = whitelistLower();
  const fixes: TextFix[] = [];
  /** suggest() у nspell дорогой — кэш на слово в рамках одного прохода текста. */
  const suggestionByLower = new Map<string, string | null>();

  for (const token of extractCyrillicWordTokens(text)) {
    const { word, from, to } = token;
    if (shouldSkipSpellToken(word)) continue;
    if (isWhitelisted(word, whitelist)) continue;
    if (overlapsExistingFix(from, to, existingFixes)) continue;
    if (isKnownWord(spell, word)) continue;

    const key = word.toLowerCase();
    let suggestion: string | null;
    if (suggestionByLower.has(key)) {
      suggestion = suggestionByLower.get(key) ?? null;
    } else {
      suggestion = suggestCorrection(spell, word);
      suggestionByLower.set(key, suggestion);
    }
    const after = suggestion ? capitalizeLike(word, suggestion) : word;

    fixes.push({
      from,
      to,
      before: word,
      after,
      ruleId: ORTHOGRAPHY_SPELL_RULE_ID,
      category: "orthography",
      message: orthographySpellMessage(word),
      priority: ORTHOGRAPHY_SPELL_PRIORITY,
      applyPolicy: "confirm",
    });
  }

  const layoutFixes = checkKeyboardLayoutFixes(text, spell, whitelist, [
    ...existingFixes,
    ...fixes,
  ]);
  if (!layoutFixes.length) return fixes;
  return [...fixes, ...layoutFixes];
}
