/** Запись о подтверждённом choice-правке на текстовом слое. */
export type ChoiceResolution = {
  ruleId: string;
  chosen: string;
  beforeAtResolve: string;
  /** Текст непосредственно перед словом (без самого слова). */
  anchorBefore: string;
  /** Текст непосредственно после слова (без самого слова). */
  anchorAfter: string;
  /** Длина слова (to − from) на момент подтверждения. */
  wordLength: number;
};

export type ChoiceFixPosition = {
  ruleId: string;
  from: number;
  to: number;
  before: string;
};

const DEFAULT_ANCHOR_RADIUS = 24;

export function buildChoiceAnchors(
  text: string,
  from: number,
  to: number,
  radius = DEFAULT_ANCHOR_RADIUS,
): { anchorBefore: string; anchorAfter: string; wordLength: number } {
  const beforeStart = Math.max(0, from - radius);
  const afterEnd = Math.min(text.length, to + radius);
  return {
    anchorBefore: text.slice(beforeStart, from),
    anchorAfter: text.slice(to, afterEnd),
    wordLength: to - from,
  };
}

export function createChoiceResolution(
  text: string,
  ruleId: string,
  from: number,
  to: number,
  beforeAtResolve: string,
  chosen: string,
): ChoiceResolution {
  const { anchorBefore, anchorAfter, wordLength } = buildChoiceAnchors(text, from, to);
  return {
    ruleId,
    chosen,
    beforeAtResolve,
    anchorBefore,
    anchorAfter,
    wordLength,
  };
}

function rangesOverlap(aFrom: number, aTo: number, bFrom: number, bTo: number): boolean {
  return aFrom < bTo && aTo > bFrom;
}

/** Все позиции слова по якорям вокруг (без учёта формы слова). */
export function findResolutionPositions(
  text: string,
  resolution: ChoiceResolution,
): Array<{ from: number; to: number }> {
  const positions: Array<{ from: number; to: number }> = [];

  if (resolution.anchorBefore.length === 0 && resolution.anchorAfter.length === 0) {
    if (text.length >= resolution.wordLength) {
      positions.push({ from: 0, to: resolution.wordLength });
    }
    return positions;
  }

  let searchFrom = 0;
  while (searchFrom <= text.length) {
    const beforeIdx =
      resolution.anchorBefore.length === 0
        ? 0
        : text.indexOf(resolution.anchorBefore, searchFrom);
    if (resolution.anchorBefore.length > 0 && beforeIdx === -1) break;

    const wordFrom =
      resolution.anchorBefore.length === 0 ? searchFrom : beforeIdx + resolution.anchorBefore.length;
    const wordTo = wordFrom + resolution.wordLength;
    if (wordTo > text.length) {
      if (resolution.anchorBefore.length === 0) break;
      searchFrom = beforeIdx + 1;
      continue;
    }

    const afterSlice = text.slice(wordTo, wordTo + resolution.anchorAfter.length);
    if (afterSlice === resolution.anchorAfter) {
      positions.push({ from: wordFrom, to: wordTo });
    }

    if (resolution.anchorBefore.length === 0) break;
    searchFrom = beforeIdx + 1;
  }

  return positions;
}

function findWholeWordOccurrences(text: string, word: string): Array<{ from: number; to: number }> {
  if (!word) return [];
  const out: Array<{ from: number; to: number }> = [];
  let from = 0;
  while (from <= text.length - word.length) {
    const idx = text.indexOf(word, from);
    if (idx === -1) break;
    const beforeOk = idx === 0 || !/\p{L}|\p{N}|_/u.test(text[idx - 1] ?? "");
    const afterIdx = idx + word.length;
    const afterOk =
      afterIdx >= text.length || !/\p{L}|\p{N}|_/u.test(text[afterIdx] ?? "");
    if (beforeOk && afterOk) {
      out.push({ from: idx, to: afterIdx });
    }
    from = idx + 1;
  }
  return out;
}

/**
 * Если якоря сломались из‑за автоправок (NBSP и т.п.), но подтверждённое слово
 * ещё на месте — пересобрать якоря, а не удалять resolution.
 */
export function reanchorResolution(
  text: string,
  resolution: ChoiceResolution,
): ChoiceResolution | null {
  const positions = findResolutionPositions(text, resolution);
  const stillValid = positions.find(
    ({ from, to }) => text.slice(from, to) === resolution.chosen,
  );
  if (stillValid) return resolution;

  const occurrences = findWholeWordOccurrences(text, resolution.chosen);
  if (!occurrences.length) return null;

  let best = occurrences[0]!;
  if (occurrences.length > 1) {
    // Предпочитаем вхождение с наиболее похожим окружением.
    let bestScore = -1;
    for (const occ of occurrences) {
      const { anchorBefore, anchorAfter } = buildChoiceAnchors(text, occ.from, occ.to);
      let score = 0;
      if (anchorBefore.endsWith(resolution.anchorBefore.slice(-8))) score += 2;
      if (anchorAfter.startsWith(resolution.anchorAfter.slice(0, 8))) score += 2;
      if (anchorBefore.includes(resolution.anchorBefore.trim())) score += 1;
      if (anchorAfter.includes(resolution.anchorAfter.trim())) score += 1;
      if (score > bestScore) {
        bestScore = score;
        best = occ;
      }
    }
  }

  return createChoiceResolution(
    text,
    resolution.ruleId,
    best.from,
    best.to,
    resolution.beforeAtResolve,
    resolution.chosen,
  );
}

/** Убрать записи, где слот исчез; при сдвиге текста из‑за автоправок — переякориться. */
export function pruneStaleResolutions(
  text: string,
  resolutions: ChoiceResolution[],
): ChoiceResolution[] {
  const kept: ChoiceResolution[] = [];
  for (const resolution of resolutions) {
    const next = reanchorResolution(text, resolution);
    if (next) kept.push(next);
  }
  return kept;
}

export function upsertChoiceResolution(
  existing: ChoiceResolution[],
  next: ChoiceResolution,
): ChoiceResolution[] {
  const withoutSameSlot = existing.filter(
    (r) =>
      !(
        r.ruleId === next.ruleId &&
        r.anchorBefore === next.anchorBefore &&
        r.anchorAfter === next.anchorAfter &&
        r.wordLength === next.wordLength
      ),
  );
  return [...withoutSameSlot, next];
}

function resolutionOverlapsFix(
  text: string,
  fix: ChoiceFixPosition,
  resolution: ChoiceResolution,
): boolean {
  return findResolutionPositions(text, resolution).some(({ from, to }) =>
    rangesOverlap(fix.from, fix.to, from, to),
  );
}

/** Не показывать choice, если пользователь уже подтвердил форму для этого вхождения. */
export function shouldSuppressChoiceFix(
  text: string,
  fix: ChoiceFixPosition,
  resolutions: ChoiceResolution[],
): boolean {
  const currentWord = text.slice(fix.from, fix.to);
  const relevant = resolutions.filter((r) => r.ruleId === fix.ruleId);

  for (const resolution of relevant) {
    if (!resolutionOverlapsFix(text, fix, resolution)) continue;

    const positions = findResolutionPositions(text, resolution);
    const overlaps = positions.filter(({ from, to }) =>
      rangesOverlap(fix.from, fix.to, from, to),
    );
    if (!overlaps.length) continue;

    // Подтверждённая форма на месте — не спрашиваем снова.
    if (currentWord === resolution.chosen) return true;

    // Слово на месте изменилось (вручную или иначе) — снова спрашиваем.
    return false;
  }

  return false;
}

/** Снять resolution, если найденное вхождение пересекается со слотом, но форма уже другая. */
export function stripInvalidatedResolutionsForFixes(
  text: string,
  fixes: ChoiceFixPosition[],
  resolutions: ChoiceResolution[],
): ChoiceResolution[] {
  return resolutions.filter((resolution) => {
    const relatedFixes = fixes.filter((fix) => fix.ruleId === resolution.ruleId);
    if (!relatedFixes.length) return true;

    const positions = findResolutionPositions(text, resolution);
    for (const fix of relatedFixes) {
      for (const slot of positions) {
        if (!rangesOverlap(fix.from, fix.to, slot.from, slot.to)) continue;
        const slotWord = text.slice(slot.from, slot.to);
        if (slotWord !== resolution.chosen) return false;
      }
    }
    return true;
  });
}

export function isChoiceResolution(value: unknown): value is ChoiceResolution {
  if (!value || typeof value !== "object") return false;
  const r = value as ChoiceResolution;
  return (
    typeof r.ruleId === "string" &&
    typeof r.chosen === "string" &&
    typeof r.beforeAtResolve === "string" &&
    typeof r.anchorBefore === "string" &&
    typeof r.anchorAfter === "string" &&
    typeof r.wordLength === "number"
  );
}

export function readChoiceResolutionsFromPluginData(raw: string): ChoiceResolution[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isChoiceResolution);
  } catch {
    return [];
  }
}

/** Найти подтверждённую форму рядом с ожидаемой позицией (после автоправок / сдвига текста). */
export function findChosenWordNear(
  text: string,
  chosen: string,
  expectedFrom: number,
  searchRadius = 48,
): number | null {
  const searchStart = Math.max(0, expectedFrom - searchRadius);
  const searchEnd = Math.min(text.length, expectedFrom + searchRadius);
  let idx = text.indexOf(chosen, searchStart);
  while (idx !== -1 && idx < searchEnd) {
    if (Math.abs(idx - expectedFrom) <= searchRadius) return idx;
    idx = text.indexOf(chosen, idx + 1);
  }
  return null;
}
