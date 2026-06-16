import { getAutofixRules } from "../rules/autofix-rules";
import { applyTextFixes, checkTextForAutofixes } from "../core/autofix-engine";
import type { ApplyPolicy } from "../core/apply-policy";
import { isConfirmPolicy, resolveApplyPolicy } from "../core/apply-policy";
import type { CheckResultDto, RuleInfo, TextFixDto, TextNodeCardDto } from "../shared/messages";
import { collectTextNodesFromSelection } from "./collect-text-nodes";

export type ScanPolicyFilter = ApplyPolicy | "all";

export type ScanSelectionOptions = {
  policy?: ScanPolicyFilter;
};

function makeFixId(nodeId: string, ruleId: string, from: number, to: number): string {
  return `${nodeId}:${ruleId}:${from}:${to}`;
}

function filterRulesByPolicy(policy: ScanPolicyFilter) {
  const all = getAutofixRules();
  if (policy === "all") return all;
  return all.filter((rule) => resolveApplyPolicy(rule.applyPolicy) === policy);
}

function toFixDto(nodeId: string, fixes: ReturnType<typeof checkTextForAutofixes>["fixes"]): TextFixDto[] {
  return fixes.map((f) => {
    const rule: RuleInfo = {
      id: f.ruleId,
      category: f.category,
      message: f.message,
      priority: f.priority,
      applyPolicy: f.applyPolicy,
    };
    return {
      fixId: makeFixId(nodeId, f.ruleId, f.from, f.to),
      from: f.from,
      to: f.to,
      before: f.before,
      after: f.after,
      rule,
    };
  });
}

function buildCards(
  textNodes: TextNode[],
  policy: ScanPolicyFilter,
): { cards: TextNodeCardDto[]; foundFixes: number } {
  const rules = filterRulesByPolicy(policy);
  const cards: TextNodeCardDto[] = [];
  let foundFixes = 0;

  for (const node of textNodes) {
    const originalText = node.characters;
    const { fixes } = checkTextForAutofixes(originalText, rules);
    if (!fixes.length) continue;

    foundFixes += fixes.length;
    const fixesDto = toFixDto(node.id, fixes);
    const previewText =
      policy === "confirm" ? originalText : applyTextFixes(originalText, fixes);

    cards.push({
      nodeId: node.id,
      nodeName: node.name,
      originalText,
      previewText,
      fixes: fixesDto,
    });
  }

  return { cards, foundFixes };
}

export function scanSelectedTextNodes(
  selection: readonly SceneNode[],
  options?: ScanSelectionOptions,
): {
  result: CheckResultDto;
  nodeById: Map<string, TextNode>;
} {
  const policy = options?.policy ?? "auto";
  const textNodes = [...collectTextNodesFromSelection(selection)];
  const nodeById = new Map<string, TextNode>();
  for (const node of textNodes) nodeById.set(node.id, node);

  const { cards, foundFixes } = buildCards(textNodes, policy);

  let confirmCards: TextNodeCardDto[] = [];
  let confirmFixes = 0;

  if (policy === "auto") {
    const confirmScan = buildCards(textNodes, "confirm");
    confirmCards = confirmScan.cards;
    confirmFixes = confirmScan.foundFixes;
  } else if (policy === "confirm") {
    confirmCards = cards;
    confirmFixes = foundFixes;
    return {
      result: {
        summary: { checkedLayers: textNodes.length, foundFixes: 0, confirmFixes },
        cards: [],
        confirmCards,
      },
      nodeById,
    };
  }

  return {
    result: {
      summary: { checkedLayers: textNodes.length, foundFixes, confirmFixes },
      cards,
      confirmCards,
    },
    nodeById,
  };
}

export function isAutoFixDto(fix: TextFixDto): boolean {
  return !isConfirmPolicy(fix.rule.applyPolicy);
}
