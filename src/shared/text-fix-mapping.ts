import type { TextFix } from "../core/autofix-engine";
import type { TextFixDto } from "./messages";

export function textFixDtoToEngineFix(fix: TextFixDto): TextFix {
  return {
    from: fix.from,
    to: fix.to,
    before: fix.before,
    after: fix.after,
    ruleId: fix.rule.id,
    category: fix.rule.category,
    message: fix.rule.message,
    priority: fix.rule.priority,
    applyPolicy: fix.rule.applyPolicy,
  };
}
