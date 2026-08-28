import { getAutofixRules } from "../rules/autofix-rules";
import { applyTextFixes, checkTextForAutofixes } from "../core/autofix-engine";
import type { TextFix } from "../core/autofix-engine";
import type { ApplyPolicy } from "../core/apply-policy";
import { resolveApplyPolicy } from "../core/apply-policy";
import type { CheckResultDto, CheckSummary, RuleInfo, TextFixDto, TextNodeCardDto, CheckedTextLayerDto } from "../shared/messages";
import { makeFixId } from "../shared/fix-id";
import { countTextCharacters } from "../shared/text-char-count";
import { collectTextNodesFromSelection } from "./collect-text-nodes";
import {
  shouldSuppressChoiceFix,
  syncChoiceResolutionsAfterScan,
} from "./choice-resolution";

export type ScanPolicyFilter = ApplyPolicy | "all";

export type ScanSelectionOptions = {
  policy?: ScanPolicyFilter;
};

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
      ...(f.hint ? { hint: f.hint } : {}),
      ...(f.choiceOptions?.length ? { choiceOptions: f.choiceOptions } : {}),
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

function filterUnresolvedChoiceFixes(node: TextNode, fixes: TextFix[]): TextFix[] {
  const text = node.characters;
  const fixPositions = fixes.map((fix) => ({
    ruleId: fix.ruleId,
    from: fix.from,
    to: fix.to,
    before: fix.before,
  }));
  const resolutions = syncChoiceResolutionsAfterScan(node, fixPositions);
  return fixes.filter(
    (fix) =>
      !shouldSuppressChoiceFix(
        text,
        { ruleId: fix.ruleId, from: fix.from, to: fix.to, before: fix.before },
        resolutions,
      ),
  );
}

function partitionFixesByPolicy(fixes: TextFix[]): {
  auto: TextFix[];
  confirm: TextFix[];
  choice: TextFix[];
} {
  const auto: TextFix[] = [];
  const confirm: TextFix[] = [];
  const choice: TextFix[] = [];

  for (const fix of fixes) {
    const policy = resolveApplyPolicy(fix.applyPolicy);
    if (policy === "confirm") confirm.push(fix);
    else if (policy === "choice") choice.push(fix);
    else auto.push(fix);
  }

  return { auto, confirm, choice };
}

function buildCheckedTextLayers(textNodes: TextNode[]): CheckedTextLayerDto[] {
  return textNodes.map((node) => ({
    nodeId: node.id,
    nodeName: node.name,
    characterCount: countTextCharacters(node.characters),
  }));
}

function buildCheckSummary(
  textNodes: TextNode[],
  partial: Omit<CheckSummary, "checkedLayers">,
): CheckSummary {
  return {
    checkedLayers: textNodes.length,
    ...partial,
  };
}

function buildCardForNode(
  node: TextNode,
  fixes: TextFix[],
  previewMode: "auto" | "manual",
): TextNodeCardDto | null {
  if (!fixes.length) return null;

  const originalText = node.characters;
  const previewText =
    previewMode === "manual" ? originalText : applyTextFixes(originalText, fixes);

  return {
    nodeId: node.id,
    nodeName: node.name,
    originalText,
    previewText,
    characterCount: countTextCharacters(originalText),
    fixes: toFixDto(node.id, fixes),
  };
}

function buildCards(
  textNodes: TextNode[],
  policy: ScanPolicyFilter,
): { cards: TextNodeCardDto[]; foundFixes: number } {
  const rules = filterRulesByPolicy(policy);
  const cards: TextNodeCardDto[] = [];
  let foundFixes = 0;

  for (const node of textNodes) {
    let { fixes } = checkTextForAutofixes(node.characters, rules);
    if (policy === "choice") {
      fixes = filterUnresolvedChoiceFixes(node, fixes);
    }
    const card = buildCardForNode(node, fixes, policy === "auto" ? "auto" : "manual");
    if (!card) continue;

    foundFixes += fixes.length;
    cards.push(card);
  }

  return { cards, foundFixes };
}

function scanAllPolicies(textNodes: TextNode[]): {
  cards: TextNodeCardDto[];
  confirmCards: TextNodeCardDto[];
  choiceCards: TextNodeCardDto[];
  foundFixes: number;
  confirmFixes: number;
  choiceFixes: number;
} {
  const rules = getAutofixRules();
  const cards: TextNodeCardDto[] = [];
  const confirmCards: TextNodeCardDto[] = [];
  const choiceCards: TextNodeCardDto[] = [];
  let foundFixes = 0;
  let confirmFixes = 0;
  let choiceFixes = 0;

  for (const node of textNodes) {
    const { fixes } = checkTextForAutofixes(node.characters, rules);
    const { auto, confirm, choice } = partitionFixesByPolicy(fixes);
    const resolvedChoice = filterUnresolvedChoiceFixes(node, choice);

    const autoCard = buildCardForNode(node, auto, "auto");
    if (autoCard) {
      foundFixes += auto.length;
      cards.push(autoCard);
    }

    const confirmCard = buildCardForNode(node, confirm, "manual");
    if (confirmCard) {
      confirmFixes += confirm.length;
      confirmCards.push(confirmCard);
    }

    const choiceCard = buildCardForNode(node, resolvedChoice, "manual");
    if (choiceCard) {
      choiceFixes += resolvedChoice.length;
      choiceCards.push(choiceCard);
    }
  }

  return { cards, confirmCards, choiceCards, foundFixes, confirmFixes, choiceFixes };
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

  const checkedTextLayers = buildCheckedTextLayers(textNodes);

  if (policy === "auto") {
    const scan = scanAllPolicies(textNodes);
    return {
      result: {
        summary: buildCheckSummary(textNodes, {
          foundFixes: scan.foundFixes,
          confirmFixes: scan.confirmFixes,
          choiceFixes: scan.choiceFixes,
        }),
        checkedTextLayers,
        cards: scan.cards,
        confirmCards: scan.confirmCards,
        choiceCards: scan.choiceCards,
      },
      nodeById,
    };
  }

  const { cards, foundFixes } = buildCards(textNodes, policy);

  if (policy === "confirm") {
    return {
      result: {
        summary: buildCheckSummary(textNodes, {
          foundFixes: 0,
          confirmFixes: foundFixes,
          choiceFixes: 0,
        }),
        checkedTextLayers,
        cards: [],
        confirmCards: cards,
        choiceCards: [],
      },
      nodeById,
    };
  }

  return {
    result: {
      summary: buildCheckSummary(textNodes, {
        foundFixes: 0,
        confirmFixes: 0,
        choiceFixes: foundFixes,
      }),
      checkedTextLayers,
      cards: [],
      confirmCards: [],
      choiceCards: cards,
    },
    nodeById,
  };
}
