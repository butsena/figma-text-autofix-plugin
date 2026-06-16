import { escapeRegex } from "../regex";

/**
 * Формы «ты» и «твой» → «вы» и «ваш».
 */
export const TY_VY_PRONOUN_PAIRS: ReadonlyArray<readonly [informal: string, formal: string]> = [
  ["тобою", "вами"],
  ["твоими", "вашими"],
  ["твоего", "вашего"],
  ["твоему", "вашему"],
  ["твоих", "ваших"],
  ["твоим", "вашим"],
  ["твоем", "вашем"],
  ["твоём", "вашем"],
  ["твоей", "вашей"],
  ["тобой", "вами"],
  ["тебя", "вас"],
  ["тебе", "вам"],
  ["твоё", "ваше"],
  ["твое", "ваше"],
  ["твою", "вашу"],
  ["твои", "ваши"],
  ["твоя", "ваша"],
  ["твой", "ваш"],
  ["ты", "вы"],
];

function titleCaseTyForm(ty: string): string {
  const lower = ty.toLowerCase();
  if (lower.startsWith("ё")) return `Ё${ty.slice(1)}`;
  return ty[0].toUpperCase() + ty.slice(1);
}

/** Все написания одной формы: регистр и ё/е. */
export function collectTySurfaceForms(ty: string): string[] {
  const forms = new Set<string>([ty, titleCaseTyForm(ty)]);
  if (ty.includes("ё")) {
    const withE = ty.replace(/ё/g, "е");
    forms.add(withE);
    forms.add(titleCaseTyForm(withE));
  }
  return [...forms];
}

/** Alternation всех поверхностных форм (для тестов и отладки). */
export function buildInformalYouAlternation(): string {
  const surfaces = new Set<string>();
  for (const [ty] of TY_VY_PRONOUN_PAIRS) {
    for (const form of collectTySurfaceForms(ty)) {
      surfaces.add(form);
    }
  }
  return [...surfaces]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join("|");
}

export function capitalizeCyrillicFirst(word: string): string {
  if (!word) return word;
  const lower = word.toLowerCase();
  if (lower.startsWith("ё")) return `Ё${word.slice(1)}`;
  return word[0].toUpperCase() + word.slice(1);
}
