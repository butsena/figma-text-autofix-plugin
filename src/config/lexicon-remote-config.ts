/** Центральный конфиг public-репозиториев и raw URL словарей плагина. */
export const LEXICON_REMOTE = {
  replacements: {
    /** Словарь замен */
    title: "Словарь замен",
    repo: "https://github.com/butsena/text-autofix-replacements",
    url: "https://raw.githubusercontent.com/butsena/text-autofix-replacements/main/text-replacements.csv",
  },
  boundaryExceptions: {
    /** Когда не нужна точка */
    title: "Когда не нужна точка",
    repo: "https://github.com/butsena/text-autofix-no-period",
    url: "https://raw.githubusercontent.com/butsena/text-autofix-no-period/main/boundary-exceptions.txt",
  },
  ambiguousFormChoices: {
    /** Формы сложных слов */
    title: "Формы сложных слов",
    repo: "https://github.com/butsena/text-autofix-word-forms",
    url: "https://raw.githubusercontent.com/butsena/text-autofix-word-forms/main/ambiguous-form-choices.txt",
  },
  spellDictionary: {
    /** Орфографический словарь */
    title: "Орфографический словарь",
    repo: "https://github.com/butsena/text-autofix-spelling",
    affUrl:
      "https://raw.githubusercontent.com/butsena/text-autofix-spelling/main/ru_RU.aff",
    dicUrl:
      "https://raw.githubusercontent.com/butsena/text-autofix-spelling/main/ru_RU.dic",
  },
  spellSupplement: {
    /** Дополнительные слова орфографии */
    title: "Дополнительные слова",
    repo: "https://github.com/butsena/text-autofix-spelling",
    url: "https://raw.githubusercontent.com/butsena/text-autofix-spelling/main/spell-supplement.txt",
  },
  spellWhitelist: {
    /** Слова, которые не считать ошибкой */
    title: "Не считать ошибкой",
    repo: "https://github.com/butsena/text-autofix-spelling",
    url: "https://raw.githubusercontent.com/butsena/text-autofix-spelling/main/spell-whitelist.txt",
  },
} as const;
