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

export const CHOICE_RESOLUTIONS_PLUGIN_KEY = "text-autofix:choice-resolutions";

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

/** Убрать записи, где якорный слот исчез или форма на месте уже не та, что подтвердили. */
export function pruneStaleResolutions(
  text: string,
  resolutions: ChoiceResolution[],
): ChoiceResolution[] {
  return resolutions.filter((resolution) => {
    const positions = findResolutionPositions(text, resolution);
    return positions.some(
      ({ from, to }) => text.slice(from, to) === resolution.chosen,
    );
  });
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

function isChoiceResolution(value: unknown): value is ChoiceResolution {
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

export function readChoiceResolutions(node: TextNode): ChoiceResolution[] {
  return readChoiceResolutionsFromPluginData(node.getPluginData(CHOICE_RESOLUTIONS_PLUGIN_KEY));
}

export function writeChoiceResolutions(node: TextNode, resolutions: ChoiceResolution[]): void {
  if (resolutions.length === 0) {
    node.setPluginData(CHOICE_RESOLUTIONS_PLUGIN_KEY, "");
    return;
  }
  node.setPluginData(CHOICE_RESOLUTIONS_PLUGIN_KEY, JSON.stringify(resolutions));
}

export function getActiveChoiceResolutions(node: TextNode): ChoiceResolution[] {
  const text = node.characters;
  const stored = readChoiceResolutions(node);
  const pruned = pruneStaleResolutions(text, stored);
  if (pruned.length !== stored.length) {
    writeChoiceResolutions(node, pruned);
  }
  return pruned;
}

export function syncChoiceResolutionsAfterScan(
  node: TextNode,
  fixes: ChoiceFixPosition[],
): ChoiceResolution[] {
  const text = node.characters;
  const active = getActiveChoiceResolutions(node);
  const stripped = stripInvalidatedResolutionsForFixes(text, fixes, active);
  if (stripped.length !== active.length) {
    writeChoiceResolutions(node, stripped);
  }
  return stripped;
}

export function recordChoiceResolutionOnNode(
  node: TextNode,
  text: string,
  fix: ChoiceFixPosition & { chosen: string },
): void {
  const resolution = createChoiceResolution(
    text,
    fix.ruleId,
    fix.from,
    fix.to,
    fix.before,
    fix.chosen,
  );
  const active = pruneStaleResolutions(text, readChoiceResolutions(node));
  writeChoiceResolutions(node, upsertChoiceResolution(active, resolution));
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
