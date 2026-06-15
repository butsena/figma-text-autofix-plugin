import yoMap from "../../data/yo-map.json";

/** «е/Е»-форма → каноничная форма с «ё/Ё» (yobase yo_sure, без yo_unsure). */
const YO_CORRECTIONS: ReadonlyMap<string, string> = new Map(
  Object.entries(yoMap as Record<string, string>),
);

function capitalizeLike(source: string, target: string): string {
  if (!source) return target;
  if (source === source.toUpperCase() && source !== source.toLowerCase()) {
    return target.toUpperCase();
  }
  if (source.charAt(0) === source.charAt(0).toUpperCase()) {
    return target.charAt(0).toUpperCase() + target.slice(1);
  }
  return target;
}

export function getYoCorrection(word: string): string | null {
  const direct = YO_CORRECTIONS.get(word);
  if (direct) return direct;

  const fromLower = YO_CORRECTIONS.get(word.toLowerCase());
  if (!fromLower) return null;

  return capitalizeLike(word, fromLower);
}
