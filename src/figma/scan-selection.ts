import { getAutofixRules } from "../rules/autofix-rules";
import { ORTHOGRAPHY_SPELL_RULE_ID } from "../rules/orthography-spell-rules";
import type { CheckResultDto, TextNodeCardDto } from "../shared/messages";
import { compareFixesByPosition } from "../shared/fix-sort";
import type { TextFix } from "../core/autofix-engine";
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
};

function isOrthographySpellFix(ruleId: string): boolean {
  return ruleId === ORTHOGRAPHY_SPELL_RULE_ID;
}

function resolveConfirmFixes(node: TextNode, confirm: TextFix[]) {
  const spellConfirm = confirm.filter((f) => isOrthographySpellFix(f.ruleId));
  const otherConfirm = confirm.filter((f) => !isOrthographySpellFix(f.ruleId));
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

export function scanSelectedTextNodes(
  selection: readonly SceneNode[],
  options?: ScanSelectionOptions,
): {
  result: CheckResultDto;
  nodeById: Map<string, TextNode>;
} {
  const policy = options?.policy ?? "auto";
  const includeSpelling = options?.includeSpelling ?? true;
  const textNodes = [...collectTextNodesFromSelection(selection)];
  const nodeById = new Map<string, TextNode>();
  for (const node of textNodes) nodeById.set(node.id, node);

  const checkedTextLayers = buildCheckedTextLayers(textNodes);

  if (policy === "auto") {
    const scan = scanAllPolicies(textNodes, includeSpelling);
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

  const { cards, foundFixes } = buildCards(textNodes, policy, includeSpelling);

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
