/** Число символов в тексте слоя (как в Figma: длина строки, включая пробелы и переносы). */
export function countTextCharacters(text: string): number {
  return text.length;
}

/** «142 символа» с правильным склонением. */
export function formatCharacterCountLabel(count: number): string {
  const n = Math.abs(count);
  const mod10 = n % 10;
  const mod100 = n % 100;
  let word = "символов";
  if (mod100 < 11 || mod100 > 14) {
    if (mod10 === 1) word = "символ";
    else if (mod10 >= 2 && mod10 <= 4) word = "символа";
  }
  return `${count} ${word}`;
}
