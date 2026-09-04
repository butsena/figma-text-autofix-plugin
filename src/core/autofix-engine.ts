import { resolveApplyPolicy, type ApplyPolicy } from "./apply-policy";
import { narrowReplacementRange } from "./narrow-replacement-range";

export type { ApplyPolicy };
export { narrowReplacementRange };

export type AutofixRule = {
  id: string;
  category: string;
  pattern: RegExp;
  replacement: string | ((match: string, ...groups: string[]) => string);
  message: string;
  /** Доп. подсказка в UI (например, мнемоника для confirm/choice-правок). */
  hint?: string;
  /** Готовый HTML подсказки (для choice со списком примеров). */
  hintHtml?: string;
  /** Равноправные варианты выбора (policy choice): кнопки в UI вместо «Исправить». */
  choiceOptions?: string[];
  priority: number;
  /** auto — применять сразу; confirm — после подтверждения; choice — выбор из вариантов. */
  applyPolicy?: ApplyPolicy;
  /** Доп. фильтр совпадения (например, отсечь ложные срабатывания на имена). */
  matchFilter?: (text: string, match: RegExpExecArray) => boolean;
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
  hint?: string;
  /** HTML-подсказка для choice (список «вопрос | пример»). */
  hintHtml?: string;
  choiceOptions?: string[];
  priority: number;
  applyPolicy: ApplyPolicy;
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

      if (rule.matchFilter && !rule.matchFilter(text, match)) continue;

      const after = computeAfter(text, match, rule);
      const isChoice = Boolean(rule.choiceOptions?.length);

      if (!isChoice && after === matched) continue;

      if (isChoice) {
        fixes.push({
          from,
          to,
          before: matched,
          after: matched,
          ruleId: rule.id,
          category: rule.category,
          message: rule.message,
          ...(rule.hint ? { hint: rule.hint } : {}),
          ...(rule.hintHtml ? { hintHtml: rule.hintHtml } : {}),
          choiceOptions: rule.choiceOptions,
          priority: rule.priority,
          applyPolicy: resolveApplyPolicy(rule.applyPolicy),
        });
        continue;
      }

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
        ...(rule.hint ? { hint: rule.hint } : {}),
        ...(rule.hintHtml ? { hintHtml: rule.hintHtml } : {}),
        priority: rule.priority,
        applyPolicy: resolveApplyPolicy(rule.applyPolicy),
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
