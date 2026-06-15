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

function regexWithoutGlobal(pattern: RegExp): RegExp {
  const flags = pattern.flags.replace(/g/g, "");
  return new RegExp(pattern.source, flags);
}

function computeAfter(fullText: string, match: RegExpExecArray, rule: AutofixRule): string {
  const matched = match[0] ?? "";
  const from = match.index;

  // Повторный прогон по подстроке ломает lookbehind вроде (?<!^) — нужна позиция в полном тексте.
  const rx = regexWithoutGlobal(rule.pattern);
  rx.lastIndex = from;
  const rematch = rx.exec(fullText);
  if (!rematch || rematch.index !== from || rematch[0] !== matched) {
    return matched;
  }

  if (typeof rule.replacement === "function") {
    return rule.replacement(rematch[0], ...rematch.slice(1));
  }
  return rematch[0].replace(rx, rule.replacement);
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

      fixes.push({
        from,
        to,
        before: matched,
        after,

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

