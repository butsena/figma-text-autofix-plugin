import { getAutofixRules } from "../rules/autofix-rules";
import type { CheckResultDto, TextNodeCardDto } from "../shared/messages";
import { collectTextNodesFromSelection } from "./collect-text-nodes";
import {
  buildCardForNode,
  buildCheckSummary,
  buildCheckedTextLayers,
  filterUnresolvedChoiceFixes,
  partitionFixesByPolicy,
} from "./scan-fix-dto";
import {
  checkTextWithSpelling,
  filterRulesByPolicy,
  type ScanPolicyFilter,
} from "./scan-text-check";

export type { ScanPolicyFilter } from "./scan-text-check";

export type ScanSelectionOptions = {
  policy?: ScanPolicyFilter;
};

function buildCards(
  textNodes: TextNode[],
  policy: ScanPolicyFilter,
): { cards: TextNodeCardDto[]; foundFixes: number } {
  const rules = filterRulesByPolicy(policy);
  const cards: TextNodeCardDto[] = [];
  let foundFixes = 0;

  for (const node of textNodes) {
    let fixes = checkTextWithSpelling(node.characters, rules);
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
    const fixes = checkTextWithSpelling(node.characters, rules);
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
