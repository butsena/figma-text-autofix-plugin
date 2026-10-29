import { getAutofixRules } from "../rules/autofix-rules";
import { annotateFailure } from "../analytics/failure";
import { isOrthographyRuleId } from "../rules/orthography-spell-rules";
import type { CheckResultDto, TextNodeCardDto } from "../shared/messages";
import { compareFixesByPosition } from "../shared/fix-sort";
import type { TextFix } from "../core/autofix-engine";
import { beginSpellCardBudget, endSpellCardBudget } from "../spell/spell-card-budget";
import { collectTextNodesFromSelection } from "./collect-text-nodes";
import {
  buildCardForNode,
  buildCheckSummary,
  buildCheckedTextLayers,
  filterUnresolvedChoiceFixes,
  partitionFixesByPolicy,
} from "./scan-fix-dto";
import {
  checkTextForAutofixesOnly,
  checkTextWithSpelling,
  filterRulesByPolicy,
  type ScanPolicyFilter,
} from "./scan-text-check";

export type { ScanPolicyFilter } from "./scan-text-check";

export type ScanSelectionOptions = {
  policy?: ScanPolicyFilter;
  /**
   * Орфопроверка Hunspell. Для цикла auto-apply — false (сильно ускоряет).
   * Для финального UI — true (по умолчанию).
   */
  includeSpelling?: boolean;
  /**
   * Только auto-правила и auto-карточки (цикл apply).
   * Без confirm/choice и без полного partition — заметно быстрее на больших выборках.
   */
  autoApplyOnly?: boolean;
};

function resolveConfirmFixes(node: TextNode, confirm: TextFix[]) {
  const spellConfirm = confirm.filter((f) => isOrthographyRuleId(f.ruleId));
  const otherConfirm = confirm.filter((f) => !isOrthographyRuleId(f.ruleId));
  return [
    ...filterUnresolvedChoiceFixes(node, spellConfirm),
    ...otherConfirm,
  ].sort(compareFixesByPosition);
}

function gatherFixes(
  text: string,
  rules: ReturnType<typeof filterRulesByPolicy>,
  includeSpelling: boolean,
): TextFix[] {
  return includeSpelling ? checkTextWithSpelling(text, rules) : checkTextForAutofixesOnly(text, rules);
}

function buildCards(
  textNodes: TextNode[],
  policy: ScanPolicyFilter,
  includeSpelling: boolean,
): { cards: TextNodeCardDto[]; foundFixes: number } {
  const rules = filterRulesByPolicy(policy);
  const cards: TextNodeCardDto[] = [];
  let foundFixes = 0;

  for (const node of textNodes) {
    let fixes = gatherFixes(node.characters, rules, includeSpelling);
    if (policy === "choice") {
      fixes = filterUnresolvedChoiceFixes(node, fixes);
    } else if (policy === "confirm") {
      fixes = resolveConfirmFixes(node, fixes);
    }
    const card = buildCardForNode(node, fixes, policy === "auto" ? "auto" : "manual");
    if (!card) continue;

    foundFixes += fixes.length;
    cards.push(card);
  }

  return { cards, foundFixes };
}

function scanAllPolicies(
  textNodes: TextNode[],
  includeSpelling: boolean,
): {
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
    const fixes = gatherFixes(node.characters, rules, includeSpelling);
    const { auto, confirm, choice } = partitionFixesByPolicy(fixes);
    const resolvedChoice = filterUnresolvedChoiceFixes(node, choice);
    const resolvedConfirm = resolveConfirmFixes(node, confirm);

    const autoCard = buildCardForNode(node, auto, "auto");
    if (autoCard) {
      foundFixes += auto.length;
      cards.push(autoCard);
    }

    const confirmCard = buildCardForNode(node, resolvedConfirm, "manual");
    if (confirmCard) {
      confirmFixes += resolvedConfirm.length;
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

function toScanResult(
  textNodes: TextNode[],
  nodeById: Map<string, TextNode>,
  payload: {
    foundFixes: number;
    confirmFixes: number;
    choiceFixes: number;
    cards: TextNodeCardDto[];
    confirmCards: TextNodeCardDto[];
    choiceCards: TextNodeCardDto[];
  },
) {
  return {
    result: {
      summary: buildCheckSummary(textNodes, {
        foundFixes: payload.foundFixes,
        confirmFixes: payload.confirmFixes,
        choiceFixes: payload.choiceFixes,
      }),
      checkedTextLayers: buildCheckedTextLayers(textNodes),
      cards: payload.cards,
      confirmCards: payload.confirmCards,
      choiceCards: payload.choiceCards,
    },
    nodeById,
  };
}

export function scanSelectedTextNodes(
  selection: readonly SceneNode[],
  options?: ScanSelectionOptions,
): { result: CheckResultDto; nodeById: Map<string, TextNode> } {
  try {
    return scanSelectedTextNodesImpl(selection, options);
  } catch (error) {
    throw annotateFailure(error, "scan", "scan_failed");
  }
}

function scanSelectedTextNodesImpl(
  selection: readonly SceneNode[],
  options?: ScanSelectionOptions,
): {
  result: CheckResultDto;
  nodeById: Map<string, TextNode>;
} {
  const policy = options?.policy ?? "auto";
  const includeSpelling = options?.includeSpelling ?? true;
  const autoApplyOnly = options?.autoApplyOnly ?? false;
  const textNodes = [...collectTextNodesFromSelection(selection)];
  const nodeById = new Map<string, TextNode>();
  for (const node of textNodes) nodeById.set(node.id, node);

  if (includeSpelling) beginSpellCardBudget();
  try {
    if (policy === "auto" && autoApplyOnly) {
      const { cards, foundFixes } = buildCards(textNodes, "auto", includeSpelling);
      return toScanResult(textNodes, nodeById, {
        foundFixes,
        confirmFixes: 0,
        choiceFixes: 0,
        cards,
        confirmCards: [],
        choiceCards: [],
      });
    }

    if (policy === "auto") {
      const scan = scanAllPolicies(textNodes, includeSpelling);
      return toScanResult(textNodes, nodeById, scan);
    }

    const { cards, foundFixes } = buildCards(textNodes, policy, includeSpelling);

    if (policy === "confirm") {
      return toScanResult(textNodes, nodeById, {
        foundFixes: 0,
        confirmFixes: foundFixes,
        choiceFixes: 0,
        cards: [],
        confirmCards: cards,
        choiceCards: [],
      });
    }

    return toScanResult(textNodes, nodeById, {
      foundFixes: 0,
      confirmFixes: 0,
      choiceFixes: foundFixes,
      cards: [],
      confirmCards: [],
      choiceCards: cards,
    });
  } finally {
    if (includeSpelling) endSpellCardBudget();
  }
}
