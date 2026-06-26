import { applyTextFixes } from "../core/autofix-engine";
import type { AutofixRule } from "../core/autofix-engine";
import { autoFixesFor } from "./helpers";

/** Как runAutofixAutoPasses: повторять, пока есть auto-правки. */
export function applyAllRulesMultiPass(
  text: string,
  rules: AutofixRule[],
  maxPasses = 20,
): { text: string; passes: number } {
  let out = text;
  let passes = 0;
  for (let i = 0; i < maxPasses; i++) {
    const fixes = autoFixesFor(out, rules);
    if (fixes.length === 0) break;
    const next = applyTextFixes(out, fixes);
    if (next === out) break;
    out = next;
    passes += 1;
  }
  return { text: out, passes };
}
