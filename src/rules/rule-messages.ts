/** Единые тексты комментариев к исправлениям в отчёте плагина. */

// —— Редполитика ——

export const MSG_RED_POLICY_TY_VY_PRONOUN =
  "Редполитика: обращение «ты» / «твой» → «вы» / «ваш»";

export const MSG_RED_POLICY_TY_VY_VERB = "Редполитика: глагол на «ты» → форма на «вы»";

export const MSG_RED_POLICY_FORMAL_YOU_LOWERCASE =
  "Редполитика: «вы» и «ваш» в середине предложения — со строчной";

export const MSG_RED_POLICY_SMS = "Редполитика: «СМС» / «SMS» → «Смс» / «смс»";

export const MSG_RED_POLICY_SENTENCE_CAP =
  "Редполитика: заглавная в начале предложения";

export const MSG_RED_POLICY_SENTENCE_PERIOD =
  "Редполитика: точка в конце предложения";

export const MSG_RED_POLICY_SINGLE_SENTENCE_NO_PERIOD =
  "Редполитика: одно предложение, точка не нужна";

export const MSG_CONFIRM_IMPLICIT_SENTENCE_PERIOD =
  "Редполитика: похоже, между словами пропущена точка";

export const MSG_CHOICE_TITLE_CASE_BOUNDARY = "Проверьте, нужна ли точка";

export function msgConfirmYoHomograph(eForm: string, yoForm: string): string {
  return `Проверьте: «${eForm}» или «${yoForm}»?`;
}

export const MSG_CHOICE_ISHCHITE_ISHCHETE = "Выберите форму глагола";

export const MSG_CHOICE_VSE_VSYO = "Выберите букву";

// —— Редполитика (лексикон) ——

export function msgLexiconReplace(variants: string[], replace: string): string {
  return `Редполитика: «${variants.join("» / «")}» → «${replace}»`;
}

// —— Бренд ——

export const MSG_BRAND_UPPERCASE = "Бренд: «ЦИАН» → «Циан»";

export const MSG_BRAND_PREP_DECLENSION = "Бренд: склонение «Циан» после предлога";

export const MSG_BRAND_NOUN_OR_NET = "Бренд: «нет ЦИАН» → «нет Циана»";

// —— Типографика ——

export const MSG_TYPO_NBSP_AFTER_SERVICE_WORD =
  "Типографика: неразрывный пробел после служебного слова";

/** Сводка нескольких space→nbsp в авто-отчёте. */
export const MSG_TYPO_NBSP_SUMMARY = "Типографика: неразрывные пробелы";

export const MSG_TYPO_NBSP_DATE_ADDRESS =
  "Типографика: неразрывный пробел в дате и адресе";

export const MSG_TYPO_NBSP_ABBREVIATION = "Типографика: неразрывный пробел в сокращении";

export const MSG_TYPO_NBSP_NUMBER = "Типографика: неразрывный пробел у числа";

export const MSG_TYPO_NBSP_BEFORE_UNIT =
  "Типографика: неразрывный пробел перед единицей измерения";

export const MSG_TYPO_NUMBER_GROUPING = "Типографика: разрядность чисел";

export const MSG_TYPO_NBSP_PERCENT = "Типографика: между числом и % пробел не ставить";

export const MSG_TYPO_REMOVE_EXTRA_SPACE = "Типографика: убрать лишний пробел";

export const MSG_TYPO_REMOVE_EXTRA_LINE_BREAK = "Типографика: убрать лишний перенос строки";

export const MSG_TYPO_REMOVE_SPACE_BEFORE_PUNCT =
  "Типографика: убрать пробел перед знаком препинания";

export const MSG_TYPO_COLLAPSE_DOUBLE_PUNCT = "Типографика: убрать повтор знака препинания";

export const MSG_TYPO_ELLIPSIS = "Типографика: многоточие вместо трёх точек";

export const MSG_TYPO_QUOTES = "Типографика: кавычки-«ёлочки»";

export const MSG_TYPO_EMDASH = "Типографика: длинное тире вместо дефиса с пробелами";

export const MSG_TYPO_EMDASH_SPACING = "Типографика: пробелы вокруг длинного тире";

export const MSG_TYPO_EMDASH_NBSP_BEFORE = "Типографика: неразрывный пробел перед длинным тире";

export const MSG_TYPO_HYPHEN_COMPOUND = "Типографика: дефис в слитном написании";

export const MSG_TYPO_NUMERIC_RANGE = "Типографика: короткое тире в диапазоне чисел";

// —— Орфография и форматы ——

export const MSG_ORTHOGRAPHY_YO = "Орфография: буква «ё» в словарных словах";

export const MSG_NORMALIZE_EMAIL = "Форматы: «email» без дефиса";

export const MSG_NORMALIZE_PHONE = "Форматы: телефон в формате +7 999 999-99-99";
