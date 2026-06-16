export type AutofixRule = {
  id: string;
  category: string;
  pattern: RegExp;
  replacement: string | ((match: string, ...groups: string[]) => string);
  message: string;
  priority: number;
};

export type TextFix = {
  from: number;
  to: number;
  before: string;
  after: string;

  // Metadata (useful for UI/debugging)
  ruleId: string;
  category: string;
  message: string;
  priority: number;
};

export type TextCheckResult = {
  fixes: TextFix[];
};

function ensureGlobalRegex(pattern: RegExp): RegExp {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return new RegExp(pattern.source, flags);
}

function expandReplacementTemplate(template: string, match: RegExpExecArray): string {
  return template.replace(/\$(\d+)|\$\$/g, (whole, n) => {
    if (whole === "$$") return "$";
    return match[Number(n)] ?? "";
  });
}

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

/**
 * Сужает диапазон замены до реально меняющейся части.
 * С краёв снимаются совпадающие разделители; неизменное слово в середине тоже
 * выносится из диапазона, если меняются только пробелы/знаки рядом с ним.
 */
export function narrowReplacementRange(
  from: number,
  before: string,
  after: string,
): { from: number; to: number; before: string; after: string } {
  if (before === after) {
    return { from, to: from + before.length, before, after };
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

  return {
    from: from + prefixLen,
    to: from + before.length - suffixLen,
    before: tailBefore.slice(0, tailBefore.length - suffixLen),
    after: tailAfter.slice(0, tailAfter.length - suffixLen),
  };
}

function computeAfter(_fullText: string, match: RegExpExecArray, rule: AutofixRule): string {
  const matched = match[0] ?? "";

  // Группы уже сняты глобальным exec в нужной позиции; повторный exec без /g
  // снова ищет с начала строки и ломает фразы вроде «не подтвержден».
  if (typeof rule.replacement === "function") {
    return rule.replacement(matched, ...match.slice(1));
  }
  return expandReplacementTemplate(rule.replacement, match);
}

/**
 * Finds all non-overlapping/overlapping regex matches across all rules.
 * Overlaps are allowed in the output; applying uses "from end to start" + `before` checks.
 */
export function checkTextForAutofixes(text: string, rules: AutofixRule[]): TextCheckResult {
  const fixes: TextFix[] = [];

  for (const rule of rules) {
    const rx = ensureGlobalRegex(rule.pattern);
    rx.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = rx.exec(text)) !== null) {
      const from = match.index;
      const matched = match[0] ?? "";
      const to = from + matched.length;

      // Avoid infinite loops for patterns that can match empty strings.
      if (matched.length === 0) {
        rx.lastIndex += 1;
      }

      // If "pattern" matched an empty string, there's nothing meaningful to replace.
      if (matched.length === 0) continue;

      const after = computeAfter(text, match, rule);
      if (after === matched) continue;

      const narrowed = narrowReplacementRange(from, matched, after);
      if (narrowed.before === narrowed.after) continue;

      fixes.push({
        from: narrowed.from,
        to: narrowed.to,
        before: narrowed.before,
        after: narrowed.after,

        ruleId: rule.id,
        category: rule.category,
        message: rule.message,
        priority: rule.priority,
      });
    }
  }

  // Deterministic ordering for UI/debugging; apply() does not rely on this.
  fixes.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    if (a.to !== b.to) return a.to - b.to;
    // Higher priority first when positions tie.
    return b.priority - a.priority;
  });

  return { fixes };
}

/**
 * Applies fixes to the provided string from end to start to keep original indices valid.
 * Also validates `before` to safely skip overlapping/stale fixes.
 */
export function applyTextFixes(text: string, fixes: TextFix[]): string {
  const ordered = [...fixes].sort((a, b) => b.from - a.from);
  let out = text;

  for (const fix of ordered) {
    const current = out.slice(fix.from, fix.to);
    if (current !== fix.before) continue;
    out = out.slice(0, fix.from) + fix.after + out.slice(fix.to);
  }

  return out;
}

