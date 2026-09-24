const UNCHANGED_EDGE_CHAR = /[0-9A-Za-zА-Яа-яЁё]/;

function tailsAreSeparatorsOnly(before: string, after: string): boolean {
  if (before.length === 0 && after.length === 0) return true;
  return (
    [...before].every((ch) => !UNCHANGED_EDGE_CHAR.test(ch)) &&
    [...after].every((ch) => !UNCHANGED_EDGE_CHAR.test(ch))
  );
}

function narrowWordSuffixChange(
  tailBefore: string,
  tailAfter: string,
): { sharedLen: number; before: string; after: string } | null {
  let sharedLen = 0;
  while (
    sharedLen < tailBefore.length &&
    sharedLen < tailAfter.length &&
    tailBefore[sharedLen] === tailAfter[sharedLen]
  ) {
    sharedLen++;
  }

  while (sharedLen > 0) {
    const restBefore = tailBefore.slice(sharedLen);
    const restAfter = tailAfter.slice(sharedLen);
    if (
      restBefore.length > 0 &&
      restAfter.startsWith(restBefore) &&
      restBefore.length < restAfter.length
    ) {
      return { sharedLen, before: restBefore, after: restAfter };
    }
    if (
      restAfter.length > 0 &&
      restBefore.startsWith(restAfter) &&
      restAfter.length < restBefore.length
    ) {
      return { sharedLen, before: restBefore, after: restAfter };
    }
    sharedLen--;
  }
  return null;
}

function simpleMiddleDiff(
  before: string,
  after: string,
): { prefixLen: number; suffixLen: number; before: string; after: string } {
  let prefixLen = 0;
  while (
    prefixLen < before.length &&
    prefixLen < after.length &&
    before[prefixLen] === after[prefixLen]
  ) {
    prefixLen++;
  }

  let suffixLen = 0;
  while (
    suffixLen < before.length - prefixLen &&
    suffixLen < after.length - prefixLen &&
    before[before.length - 1 - suffixLen] === after[after.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  return {
    prefixLen,
    suffixLen,
    before: before.slice(prefixLen, before.length - suffixLen),
    after: after.slice(prefixLen, after.length - suffixLen),
  };
}

function isCaseOnlyChange(before: string, after: string): boolean {
  return (
    before.length > 0 &&
    before.length === after.length &&
    before !== after &&
    before.toLowerCase() === after.toLowerCase()
  );
}

/**
 * Сужает диапазон замены до реально меняющейся части.
 * С краёв снимаются совпадающие разделители; неизменное слово в середине тоже
 * выносится из диапазона, если меняются только пробелы/знаки рядом с ним.
 *
 * Смена только регистра («1. п» → «1. П», «период 2. п» → …) всегда сужается
 * до отличающихся букв — иначе в Figma длинный before легко устаревает.
 */
export function narrowReplacementRange(
  from: number,
  before: string,
  after: string,
): { from: number; to: number; before: string; after: string } {
  if (before === after) {
    return { from, to: from + before.length, before, after };
  }

  if (isCaseOnlyChange(before, after)) {
    const simple = simpleMiddleDiff(before, after);
    // Только однобуквенная смена регистра («1. п»→«П») — не дробим «ЦИАН»→«Циан».
    if (simple.before.length === 1 && simple.after.length === 1) {
      return {
        from: from + simple.prefixLen,
        to: from + before.length - simple.suffixLen,
        before: simple.before,
        after: simple.after,
      };
    }
  }

  let prefixLen = 0;
  while (
    prefixLen < before.length &&
    prefixLen < after.length &&
    before[prefixLen] === after[prefixLen] &&
    !UNCHANGED_EDGE_CHAR.test(before[prefixLen])
  ) {
    prefixLen++;
  }

  let tailBefore = before.slice(prefixLen);
  let tailAfter = after.slice(prefixLen);

  const suffixChange = narrowWordSuffixChange(tailBefore, tailAfter);
  if (suffixChange) {
    prefixLen += suffixChange.sharedLen;
    tailBefore = suffixChange.before;
    tailAfter = suffixChange.after;
  } else {
    let sharedWordPrefix = 0;
    while (
      sharedWordPrefix < tailBefore.length &&
      sharedWordPrefix < tailAfter.length &&
      tailBefore[sharedWordPrefix] === tailAfter[sharedWordPrefix]
    ) {
      sharedWordPrefix++;
    }

    if (
      sharedWordPrefix > 0 &&
      tailsAreSeparatorsOnly(
        tailBefore.slice(sharedWordPrefix),
        tailAfter.slice(sharedWordPrefix),
      )
    ) {
      prefixLen += sharedWordPrefix;
      tailBefore = tailBefore.slice(sharedWordPrefix);
      tailAfter = tailAfter.slice(sharedWordPrefix);
    }
  }

  let suffixLen = 0;
  while (
    suffixLen < tailBefore.length &&
    suffixLen < tailAfter.length &&
    tailBefore[tailBefore.length - 1 - suffixLen] === tailAfter[tailAfter.length - 1 - suffixLen] &&
    !UNCHANGED_EDGE_CHAR.test(tailBefore[tailBefore.length - 1 - suffixLen])
  ) {
    suffixLen++;
  }

  const narrowedBefore = tailBefore.slice(0, tailBefore.length - suffixLen);
  const narrowedAfter = tailAfter.slice(0, tailAfter.length - suffixLen);

  if (
    narrowedBefore.length > 1 &&
    narrowedBefore.length > before.length / 2 &&
    before.length >= 40 &&
    Math.abs(after.length - before.length) <= 3
  ) {
    const simple = simpleMiddleDiff(before, after);
    if (simple.before.length < narrowedBefore.length && simple.before !== simple.after) {
      return {
        from: from + simple.prefixLen,
        to: from + before.length - simple.suffixLen,
        before: simple.before,
        after: simple.after,
      };
    }
  }

  return {
    from: from + prefixLen,
    to: from + before.length - suffixLen,
    before: narrowedBefore,
    after: narrowedAfter,
  };
}
