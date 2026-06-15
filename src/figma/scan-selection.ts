import { getAutofixRules } from "../rules/autofix-rules";
import { applyTextFixes, checkTextForAutofixes } from "../core/autofix-engine";
import type { CheckResultDto, RuleInfo, TextFixDto, TextNodeCardDto } from "../shared/messages";
import { collectTextNodesFromSelection } from "./collect-text-nodes";

function makeFixId(nodeId: string, ruleId: string, from: number, to: number): string {
  return `${nodeId}:${ruleId}:${from}:${to}`;
}

export function scanSelectedTextNodes(selection: readonly SceneNode[]): CheckResultDto {
  const autofixRules = getAutofixRules();
  const textNodes = [...collectTextNodesFromSelection(selection)];
  const cards: TextNodeCardDto[] = [];
  let foundFixes = 0;

  for (const node of textNodes) {
    const originalText = node.characters;
    const { fixes } = checkTextForAutofixes(originalText, autofixRules);
    if (!fixes.length) continue;

    foundFixes += fixes.length;
    const previewText = applyTextFixes(originalText, fixes);

    const fixesDto: TextFixDto[] = fixes.map((f) => {
      const rule: RuleInfo = {
        id: f.ruleId,
        category: f.category,
        message: f.message,
        priority: f.priority,
      };
      return {
        fixId: makeFixId(node.id, f.ruleId, f.from, f.to),
        from: f.from,
        to: f.to,
        before: f.before,
        after: f.after,
        rule,
      };
    });

    cards.push({
      nodeId: node.id,
      nodeName: node.name,
      originalText,
      previewText,
      fixes: fixesDto,
    });
  }

  return {
    summary: { checkedLayers: textNodes.length, foundFixes },
    cards,
  };
}
