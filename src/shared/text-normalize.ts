/** Убрать UTF-8 BOM в начале текста, скачанного с GitHub. */
export function stripUtf8Bom(raw: string): string {
  return raw.replace(/^\uFEFF/, "");
}
