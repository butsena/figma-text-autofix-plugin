/** Центральный конфиг public-репозиториев и raw URL словарей плагина. */
export const LEXICON_REMOTE = {
  replacements: {
    repo: "https://github.com/butsena/figma-text-autofix-lexicon",
    url: "https://raw.githubusercontent.com/butsena/figma-text-autofix-lexicon/main/text-replacements.csv",
  },
  boundaryExceptions: {
    repo: "https://github.com/butsena/figma-text-autofix-boundary-exceptions",
    url: "https://raw.githubusercontent.com/butsena/figma-text-autofix-boundary-exceptions/main/boundary-exceptions.txt",
  },
  ambiguousFormChoices: {
    repo: "https://github.com/butsena/figma-text-autofix-ambiguous-form-choices",
    url: "https://raw.githubusercontent.com/butsena/figma-text-autofix-ambiguous-form-choices/main/ambiguous-form-choices.txt",
  },
  spellDictionary: {
    repo: "https://github.com/butsena/figma-text-autofix-spell-dictionary",
    affUrl:
      "https://raw.githubusercontent.com/butsena/figma-text-autofix-spell-dictionary/main/ru_RU.aff",
    dicUrl:
      "https://raw.githubusercontent.com/butsena/figma-text-autofix-spell-dictionary/main/ru_RU.dic",
  },
  spellSupplement: {
    repo: "https://github.com/butsena/figma-text-autofix-spell-dictionary",
    url: "https://raw.githubusercontent.com/butsena/figma-text-autofix-spell-dictionary/main/spell-supplement.txt",
  },
  spellWhitelist: {
    repo: "https://github.com/butsena/figma-text-autofix-spell-dictionary",
    url: "https://raw.githubusercontent.com/butsena/figma-text-autofix-spell-dictionary/main/spell-whitelist.txt",
  },
} as const;
