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
  casingForSuggestion,
  extractLatinLayoutTokens,
  extractMixedScriptTokens,
  isLikelyUrlOrEmailContext,
  shouldSkipLatinLayoutToken,
  suggestMixedScriptRu,
  suggestRuFromLatinLayout,
  textHasCyrillic,
} from "./keyboard-layout";
import {
  extractCyrillicWordTokens,
  rangesOverlap,
  shouldSkipSpellToken,
} from "./tokenize-cyrillic-words";
import { takeSpellCardSlot } from "./spell-card-budget";
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

/** Латиница токена уже целиком внутри другой правки — вторую карточку не дублируем. */
function latinCharsCoveredByFixes(from: number, word: string, fixes: readonly TextFix[]): boolean {
  let sawLatin = false;
  for (let i = 0; i < word.length; i++) {
    if (!/[A-Za-z]/.test(word[i])) continue;
    sawLatin = true;
    const pos = from + i;
    const covered = fixes.some((fix) => pos >= fix.from && pos < fix.to);
    if (!covered) return false;
  }
  return sawLatin;
}

function checkMixedScriptFixes(
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
    // Choice на кириллической основе («пишете» внутри «yпишете») не закрывает латинскую букву.
    if (latinCharsCoveredByFixes(from, word, existingFixes)) continue;
    if (latinCharsCoveredByFixes(from, word, fixes)) continue;

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

  return fixes;
}

function checkLatinLayoutFixes(
  text: string,
  spell: SpellChecker,
  whitelist: Set<string>,
  existingFixes: readonly TextFix[],
): TextFix[] {
  if (!textHasCyrillic(text)) return [];

  const fixes: TextFix[] = [];

  for (const token of extractLatinLayoutTokens(text)) {
    const { word, from, to } = token;
    if (shouldSkipLatinLayoutToken(word)) continue;
    if (isWhitelisted(word, whitelist)) continue;
    if (isLikelyUrlOrEmailContext(text, from, to)) continue;
    if (overlapsExistingFix(from, to, existingFixes)) continue;
    if (overlapsExistingFix(from, to, fixes)) continue;

    const suggestedRu = suggestRuFromLatinLayout(word, (w) => isKnownWord(spell, w));
    if (!suggestedRu) continue;
    const knownRu = isKnownWord(spell, suggestedRu);

    const cased = knownRu
      ? casingForSuggestion(text, from, suggestedRu)
      : capitalizeLike(word, suggestedRu);
    const prev = from > 0 ? text.charAt(from - 1) : "";
    const gluedToLetter = /^[^A-Za-z]/.test(word) && /[A-Za-zА-Яа-яЁё]/.test(prev);
    const after = gluedToLetter && !/^\s/.test(cased) ? ` ${cased}` : cased;

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

  // Смешанные слова (yпишете) раскладка чинит целиком — считаем их первыми,
  // чтобы орфография не ругалась на кириллические обрывки вокруг латинской буквы.
  const mixedFixes = checkMixedScriptFixes(text, spell, whitelist, existingFixes);
  const spellExisting = [...existingFixes, ...mixedFixes];

  // Проход 1: только «знает / не знает». suggest — ниже, для уникальных форм и с лимитом карточек.
  const unknown: { word: string; from: number; to: number }[] = [];
  for (const token of extractCyrillicWordTokens(text)) {
    const { word, from, to } = token;
    if (shouldSkipSpellToken(word)) continue;
    if (isWhitelisted(word, whitelist)) continue;
    if (overlapsExistingFix(from, to, spellExisting)) continue;
    if (isKnownWord(spell, word)) continue;
    unknown.push(token);
  }

  let emitted = 0;
  for (const token of unknown) {
    if (!takeSpellCardSlot(emitted)) break;
    emitted += 1;
    const { word, from, to } = token;
    const suggestion = suggestCorrection(spell, word);
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

  const latinFixes = checkLatinLayoutFixes(text, spell, whitelist, [
    ...spellExisting,
    ...fixes,
  ]);
  return [...fixes, ...mixedFixes, ...latinFixes];
}
