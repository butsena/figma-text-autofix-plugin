import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import { escapeRegex, LATIN_CYRILLIC_WORD_LOOKBEHIND } from "../regex";
import { MSG_TYPO_NBSP_AFTER_SERVICE_WORD } from "../rule-messages";
import { HORIZONTAL_SPACE, LINE_BREAK, NBSP } from "./constants";
import { RU_SERVICE_WORDS, serviceWordPattern } from "./ru-service-words";

function wordNbspPattern(word: string, suffix: string): RegExp {
  return new RegExp(`${LATIN_CYRILLIC_WORD_LOOKBEHIND}(${escapeRegex(word)})${suffix}`, "gim");
}

function serviceWordRuleId(word: string, acrossLineBreak = false): string {
  return acrossLineBreak ? `cian-095b-nbsp-${word}-linebreak` : `cian-095-nbsp-${word}`;
}

function buildPerWordNbspRules(): AutofixRule[] {
  return RU_SERVICE_WORDS.flatMap((word) => [
    rule({
      id: serviceWordRuleId(word),
      category: "typography",
      pattern: wordNbspPattern(word, `${HORIZONTAL_SPACE}+(?=\\S)`),
      replacement: (_match, matchedWord: string) => `${matchedWord}${NBSP}`,
      message: MSG_TYPO_NBSP_AFTER_SERVICE_WORD,
      priority: 52,
    }),
    rule({
      id: serviceWordRuleId(word, true),
      category: "typography",
      pattern: wordNbspPattern(
        word,
        `(?:${HORIZONTAL_SPACE}*${LINE_BREAK}${HORIZONTAL_SPACE}*)(?=\\S)`,
      ),
      replacement: (_match, matchedWord: string) => `${matchedWord}${NBSP}`,
      message: MSG_TYPO_NBSP_AFTER_SERVICE_WORD,
      priority: 52,
    }),
  ]);
}

export function buildServiceWordNbspRules(): AutofixRule[] {
  return rules([
    ...buildPerWordNbspRules(),
    rule({
      id: "cian-097-nbsp-after-service-words-before-line-end",
      category: "typography",
      pattern: serviceWordPattern(`(?:${HORIZONTAL_SPACE}{2,})(?=(?:${LINE_BREAK}|$))`),
      replacement: (_match, prefix, matchedWord) => `${prefix}${matchedWord}${NBSP}`,
      message: MSG_TYPO_NBSP_AFTER_SERVICE_WORD,
      priority: 53,
    }),
    rule({
      id: "cian-099-nbsp-after-service-words-trailing-newlines-at-eof",
      category: "typography",
      pattern: serviceWordPattern(`((?:(?:${HORIZONTAL_SPACE}*${LINE_BREAK})+(?:${HORIZONTAL_SPACE}*)?)+)$`, "gi"),
      replacement: (_match, prefix, matchedWord, tail) => {
        const keepFinalNl = /(?:\r?\n)\s*$/.test(tail);
        return keepFinalNl ? `${prefix}${matchedWord}${NBSP}\n` : `${prefix}${matchedWord}${NBSP}`;
      },
      message: MSG_TYPO_NBSP_AFTER_SERVICE_WORD,
      priority: 55,
    }),
  ]);
}
