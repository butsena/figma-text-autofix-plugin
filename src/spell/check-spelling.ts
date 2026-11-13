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
  type CyrillicWordToken,
} from "./tokenize-cyrillic-words";
import { buildNeVerbFixes } from "./ne-verb-split";
import { takeSpellCardSlot } from "./spell-card-budget";
import { getSpellWhitelistWords } from "./spell-word-list-store";

type Range = { from: number; to: number };

function whitelistLower(): Set<string> {
  return new Set(getSpellWhitelistWords().map((w) => w.toLowerCase()));
}

function isWhitelisted(word: string, whitelist: Set<string>): boolean {
  return whitelist.has(word.toLowerCase());
}

function overlapsExistingFix(from: number, to: number, fixes: readonly Range[]): boolean {
  return fixes.some((fix) => rangesOverlap(from, to, fix.from, fix.to));
}

function knownChecker(spell: SpellChecker): (word: string) => boolean {
  return (word) => isKnownWord(spell, word);
}

function layoutConfirmFix(from: number, to: number, before: string, after: string): TextFix {
  return {
    from,
    to,
    before,
    after,
    ruleId: ORTHOGRAPHY_LAYOUT_RULE_ID,
    category: "orthography",
    message: orthographyLayoutMessage(before),
    priority: ORTHOGRAPHY_LAYOUT_PRIORITY,
    applyPolicy: "confirm",
  };
}

function spellConfirmFix(from: number, to: number, before: string, after: string): TextFix {
  return {
    from,
    to,
    before,
    after,
    ruleId: ORTHOGRAPHY_SPELL_RULE_ID,
    category: "orthography",
    message: orthographySpellMessage(before),
    priority: ORTHOGRAPHY_SPELL_PRIORITY,
    applyPolicy: "confirm",
  };
}

/** Латиница токена уже целиком внутри другой правки — вторую карточку не дублируем. */
function latinCharsCoveredByFixes(from: number, word: string, fixes: readonly Range[]): boolean {
  let sawLatin = false;
  for (let i = 0; i < word.length; i++) {
    if (!/[A-Za-z]/.test(word[i]!)) continue;
    sawLatin = true;
    const pos = from + i;
    const covered = fixes.some((fix) => pos >= fix.from && pos < fix.to);
    if (!covered) return false;
  }
  return sawLatin;
}

function shouldSkipLayoutToken(
  text: string,
  from: number,
  to: number,
  word: string,
  whitelist: Set<string>,
): boolean {
  return isWhitelisted(word, whitelist) || isLikelyUrlOrEmailContext(text, from, to);
}

function checkMixedScriptFixes(
  text: string,
  spell: SpellChecker,
  whitelist: Set<string>,
  existingFixes: readonly TextFix[],
): TextFix[] {
  if (!textHasCyrillic(text)) return [];

  const fixes: TextFix[] = [];
  const known = knownChecker(spell);

  for (const token of extractMixedScriptTokens(text)) {
    const { word, from, to } = token;
    if (shouldSkipLayoutToken(text, from, to, word, whitelist)) continue;
    // Choice на кириллической основе («пишете» внутри «yпишете») не закрывает латинскую букву.
    if (latinCharsCoveredByFixes(from, word, existingFixes)) continue;
    if (latinCharsCoveredByFixes(from, word, fixes)) continue;

    const suggested = suggestMixedScriptRu(word, known);
    const knownSuggestion = suggested && suggested !== word ? suggested : null;
    // Подсказку пишем только для слова из словаря. Иначе карточка есть, поле пустое:
    // «лctt» и «kjjклk’;kg» — мусор, готовой замены нет.
    if (!knownSuggestion && word.replace(/[^A-Za-z]/g, "").length < 2) continue;

    const after = knownSuggestion ? casingForSuggestion(text, from, knownSuggestion) : word;
    fixes.push(layoutConfirmFix(from, to, word, after));
  }

  return fixes;
}

function checkLatinLayoutFixes(
  text: string,
  spell: SpellChecker,
  whitelist: Set<string>,
  existingFixes: readonly TextFix[],
): TextFix[] {
  const fixes: TextFix[] = [];
  const mixedSpans = extractMixedScriptTokens(text);
  const known = knownChecker(spell);

  for (const token of extractLatinLayoutTokens(text)) {
    const { word, from, to } = token;
    if (shouldSkipLatinLayoutToken(word)) continue;
    if (shouldSkipLayoutToken(text, from, to, word, whitelist)) continue;
    if (mixedSpans.some((span) => rangesOverlap(from, to, span.from, span.to))) continue;
    if (overlapsExistingFix(from, to, existingFixes) || overlapsExistingFix(from, to, fixes)) continue;

    const suggestedRu = suggestRuFromLatinLayout(word, known);
    if (!suggestedRu) continue;
    const knownRu = known(suggestedRu);

    const cased = knownRu
      ? casingForSuggestion(text, from, suggestedRu)
      : capitalizeLike(word, suggestedRu);
    const prev = from > 0 ? text.charAt(from - 1) : "";
    const gluedToLetter = /^[^A-Za-z]/.test(word) && /[A-Za-zА-Яа-яЁё]/.test(prev);
    const after = gluedToLetter && !/^\s/.test(cased) ? ` ${cased}` : cased;

    fixes.push(layoutConfirmFix(from, to, word, after));
  }

  return fixes;
}

function collectUnknownCyrillicTokens(
  text: string,
  spell: SpellChecker,
  whitelist: Set<string>,
  occupied: readonly Range[],
  mixedSpans: readonly Range[],
): CyrillicWordToken[] {
  const unknown: CyrillicWordToken[] = [];
  const overlapsMixedSpan = (from: number, to: number) =>
    mixedSpans.some((span) => rangesOverlap(from, to, span.from, span.to));

  for (const token of extractCyrillicWordTokens(text)) {
    const { word, from, to } = token;
    if (shouldSkipSpellToken(word)) continue;
    if (isWhitelisted(word, whitelist)) continue;
    if (overlapsExistingFix(from, to, occupied)) continue;
    if (overlapsMixedSpan(from, to)) continue;
    if (isKnownWord(spell, word)) continue;
    unknown.push(token);
  }
  return unknown;
}

/** Проверка орфографии Hunspell; возвращает confirm-правки без пересечения с уже найденными. */
export function checkSpellingFixes(text: string, existingFixes: readonly TextFix[] = []): TextFix[] {
  if (!SPELLCHECK_ENABLED) return [];

  const spell = getSpellChecker();
  if (!spell) return [];

  const whitelist = whitelistLower();
  const known = knownChecker(spell);

  // Смешанные слова (yпишете) раскладка чинит целиком — считаем их первыми,
  // чтобы орфография не ругалась на кириллические обрывки вокруг латинской буквы.
  const mixedFixes = checkMixedScriptFixes(text, spell, whitelist, existingFixes);
  // «неотключите» → confirm «не отключите» до обычной орфографии, иначе уйдёт в поле ввода.
  const neVerbFixes = buildNeVerbFixes(text, known, {
    skipWord: (word) => isWhitelisted(word, whitelist),
    occupied: [...existingFixes, ...mixedFixes],
  });
  const spellExisting = [...existingFixes, ...mixedFixes, ...neVerbFixes];
  const mixedSpans = extractMixedScriptTokens(text);

  const unknown = collectUnknownCyrillicTokens(text, spell, whitelist, spellExisting, mixedSpans);
  const fixes: TextFix[] = [];
  let emitted = 0;
  for (const token of unknown) {
    if (!takeSpellCardSlot(emitted)) break;
    emitted += 1;
    const { word, from, to } = token;
    const suggestion = suggestCorrection(spell, word);
    const after = suggestion ? capitalizeLike(word, suggestion) : word;
    fixes.push(spellConfirmFix(from, to, word, after));
  }

  const latinFixes = checkLatinLayoutFixes(text, spell, whitelist, [
    ...spellExisting,
    ...fixes,
  ]);
  return [...fixes, ...mixedFixes, ...latinFixes, ...neVerbFixes];
}
