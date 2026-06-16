/** Один символ текста до замены — для переноса на вставленный фрагмент. */
export type CharTextStyle = {
  fontName: FontName;
  fontSize: number;
  fills: Paint[];
  /** false — не вызывать setRangeFills (значение неизвестно). */
  fillsKnown: boolean;
  letterSpacing: LetterSpacing;
  lineHeight: LineHeight;
  textCase: TextCase;
  textDecoration: TextDecoration;
  textStyleId: string;
  fillStyleId: string;
  /** Локальное переопределение шрифта поверх text style. */
  localFontOverride: boolean;
};

/** Развернуть/сжать стили: новые символы наследуют стиль последнего заменённого. */
export function mapStylesForReplacement(
  captured: CharTextStyle[],
  newLen: number,
): CharTextStyle[] {
  if (newLen === 0 || captured.length === 0) return [];
  const template = captured[captured.length - 1];
  const head = captured[0];
  if (newLen <= captured.length) return captured.slice(0, newLen);
  const extra = Array.from({ length: newLen - captured.length }, () => template);
  // При вставке суффикса (и→ите) надёжнее стиль первого символа заменяемого хвоста.
  if (captured.length === 1) {
    return Array.from({ length: newLen }, () => head);
  }
  return [...captured, ...extra];
}

function isMixed<T>(value: T | typeof figma.mixed): value is typeof figma.mixed {
  return value === figma.mixed;
}

const FALLBACK_LETTER_SPACING: LetterSpacing = { unit: "PERCENT", value: 0 };
const FALLBACK_LINE_HEIGHT: LineHeight = { unit: "AUTO" };

/** Figma plugin runtime не гарантирует structuredClone. */
function clonePaints(fills: Paint[]): Paint[] {
  return JSON.parse(JSON.stringify(fills)) as Paint[];
}

function captureCharStyle(textNode: TextNode, index: number): CharTextStyle | null {
  const end = index + 1;
  if (index < 0 || end > textNode.characters.length) return null;

  const textStyleId = textNode.getRangeTextStyleId(index, end);
  const fillStyleId = textNode.getRangeFillStyleId(index, end);
  const fontName = textNode.getRangeFontName(index, end);

  if (!isMixed(textStyleId) && textStyleId) {
    if (!isMixed(fontName)) {
      const fontSize = textNode.getRangeFontSize(index, end);
      const fills = textNode.getRangeFills(index, end);
      const letterSpacing = textNode.getRangeLetterSpacing(index, end);
      const lineHeight = textNode.getRangeLineHeight(index, end);
      const textCase = textNode.getRangeTextCase(index, end);
      const textDecoration = textNode.getRangeTextDecoration(index, end);

      return {
        textStyleId,
        fillStyleId: isMixed(fillStyleId) ? "" : fillStyleId,
        fontName,
        fontSize: isMixed(fontSize) ? 12 : fontSize,
        fills: isMixed(fills) ? [] : clonePaints(fills),
        fillsKnown: !isMixed(fills),
        letterSpacing: isMixed(letterSpacing) ? FALLBACK_LETTER_SPACING : letterSpacing,
        lineHeight: isMixed(lineHeight) ? FALLBACK_LINE_HEIGHT : lineHeight,
        textCase: isMixed(textCase) ? "ORIGINAL" : textCase,
        textDecoration: isMixed(textDecoration) ? "NONE" : textDecoration,
        localFontOverride: true,
      };
    }

    return {
      textStyleId,
      fillStyleId: isMixed(fillStyleId) ? "" : fillStyleId,
      fontName: { family: "Inter", style: "Regular" },
      fontSize: 12,
      fills: [],
      fillsKnown: false,
      letterSpacing: FALLBACK_LETTER_SPACING,
      lineHeight: FALLBACK_LINE_HEIGHT,
      textCase: "ORIGINAL",
      textDecoration: "NONE",
      localFontOverride: false,
    };
  }

  if (isMixed(fontName)) return null;

  const fontSize = textNode.getRangeFontSize(index, end);
  const fills = textNode.getRangeFills(index, end);
  const letterSpacing = textNode.getRangeLetterSpacing(index, end);
  const lineHeight = textNode.getRangeLineHeight(index, end);
  const textCase = textNode.getRangeTextCase(index, end);
  const textDecoration = textNode.getRangeTextDecoration(index, end);

  return {
    fontName,
    fontSize: isMixed(fontSize) ? 12 : fontSize,
    fills: isMixed(fills) ? [] : clonePaints(fills),
    fillsKnown: !isMixed(fills),
    letterSpacing: isMixed(letterSpacing) ? FALLBACK_LETTER_SPACING : letterSpacing,
    lineHeight: isMixed(lineHeight) ? FALLBACK_LINE_HEIGHT : lineHeight,
    textCase: isMixed(textCase) ? "ORIGINAL" : textCase,
    textDecoration: isMixed(textDecoration) ? "NONE" : textDecoration,
    textStyleId: "",
    fillStyleId: isMixed(fillStyleId) ? "" : fillStyleId,
    localFontOverride: false,
  };
}

export function captureRangeStyles(textNode: TextNode, from: number, to: number): CharTextStyle[] {
  const styles: CharTextStyle[] = [];
  let fallback: CharTextStyle | null = from > 0 ? captureCharStyle(textNode, from - 1) : null;

  for (let i = from; i < to; i++) {
    const style = captureCharStyle(textNode, i) ?? fallback;
    if (!style) return [];
    fallback = style;
    styles.push(style);
  }
  return styles;
}

async function loadFontsForStyles(styles: CharTextStyle[]): Promise<void> {
  const seen = new Set<string>();
  for (const style of styles) {
    if (style.textStyleId && !style.localFontOverride) continue;
    const key = `${style.fontName.family}__${style.fontName.style}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await figma.loadFontAsync(style.fontName);
  }
}

async function applyCharStyle(textNode: TextNode, index: number, style: CharTextStyle): Promise<void> {
  const end = index + 1;

  if (style.textStyleId) {
    await textNode.setRangeTextStyleIdAsync(index, end, style.textStyleId);
    if (style.fillStyleId) {
      await textNode.setRangeFillStyleIdAsync(index, end, style.fillStyleId);
    }
    if (style.localFontOverride) {
      textNode.setRangeFontName(index, end, style.fontName);
      textNode.setRangeFontSize(index, end, style.fontSize);
      if (!style.fillStyleId && style.fillsKnown) {
        textNode.setRangeFills(index, end, style.fills);
      }
      textNode.setRangeLetterSpacing(index, end, style.letterSpacing);
      textNode.setRangeLineHeight(index, end, style.lineHeight);
      textNode.setRangeTextCase(index, end, style.textCase);
      textNode.setRangeTextDecoration(index, end, style.textDecoration);
    }
    return;
  }

  textNode.setRangeFontName(index, end, style.fontName);
  textNode.setRangeFontSize(index, end, style.fontSize);
  if (style.fillStyleId) {
    await textNode.setRangeFillStyleIdAsync(index, end, style.fillStyleId);
  } else if (style.fillsKnown) {
    textNode.setRangeFills(index, end, style.fills);
  }
  textNode.setRangeLetterSpacing(index, end, style.letterSpacing);
  textNode.setRangeLineHeight(index, end, style.lineHeight);
  textNode.setRangeTextCase(index, end, style.textCase);
  textNode.setRangeTextDecoration(index, end, style.textDecoration);
}

function stylesAreUniform(styles: CharTextStyle[]): boolean {
  if (styles.length <= 1) return true;
  const first = styles[0];
  return styles.every(
    (s) =>
      s.fontName.family === first.fontName.family &&
      s.fontName.style === first.fontName.style &&
      s.fontSize === first.fontSize &&
      s.textDecoration === first.textDecoration &&
      s.textCase === first.textCase &&
      s.textStyleId === first.textStyleId &&
      s.fillStyleId === first.fillStyleId,
  );
}

async function applyUniformStyle(
  textNode: TextNode,
  from: number,
  to: number,
  style: CharTextStyle,
): Promise<void> {
  if (style.textStyleId) {
    await textNode.setRangeTextStyleIdAsync(from, to, style.textStyleId);
    if (style.fillStyleId) {
      await textNode.setRangeFillStyleIdAsync(from, to, style.fillStyleId);
    }
    if (style.localFontOverride) {
      textNode.setRangeFontName(from, to, style.fontName);
      textNode.setRangeFontSize(from, to, style.fontSize);
      if (!style.fillStyleId && style.fillsKnown) {
        textNode.setRangeFills(from, to, style.fills);
      }
      textNode.setRangeLetterSpacing(from, to, style.letterSpacing);
      textNode.setRangeLineHeight(from, to, style.lineHeight);
      textNode.setRangeTextCase(from, to, style.textCase);
      textNode.setRangeTextDecoration(from, to, style.textDecoration);
    }
    return;
  }

  textNode.setRangeFontName(from, to, style.fontName);
  textNode.setRangeFontSize(from, to, style.fontSize);
  if (style.fillStyleId) {
    await textNode.setRangeFillStyleIdAsync(from, to, style.fillStyleId);
  } else if (style.fillsKnown) {
    textNode.setRangeFills(from, to, style.fills);
  }
  textNode.setRangeLetterSpacing(from, to, style.letterSpacing);
  textNode.setRangeLineHeight(from, to, style.lineHeight);
  textNode.setRangeTextCase(from, to, style.textCase);
  textNode.setRangeTextDecoration(from, to, style.textDecoration);
}

export function captureCharStyleAt(textNode: TextNode, index: number): CharTextStyle | null {
  return captureCharStyle(textNode, index);
}

export async function applyCharStyleAt(
  textNode: TextNode,
  index: number,
  style: CharTextStyle,
): Promise<void> {
  await loadFontsForStyles([style]);
  await applyCharStyle(textNode, index, style);
}

export async function restoreRangeStyles(
  textNode: TextNode,
  from: number,
  captured: CharTextStyle[],
  newLen: number,
): Promise<void> {
  const mapped = mapStylesForReplacement(captured, newLen);
  if (mapped.length === 0) return;

  await loadFontsForStyles(mapped);

  if (stylesAreUniform(mapped)) {
    await applyUniformStyle(textNode, from, from + newLen, mapped[0]);
    return;
  }

  for (let i = 0; i < newLen; i++) {
    await applyCharStyle(textNode, from + i, mapped[i]);
  }
}
