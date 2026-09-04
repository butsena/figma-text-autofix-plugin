import { applyTextFixes, type TextFix } from "../core/autofix-engine";
import { resolveApplyPolicy } from "../core/apply-policy";
import type {
  CheckSummary,
  CheckedTextLayerDto,
  RuleInfo,
  TextFixDto,
  TextNodeCardDto,
} from "../shared/messages";
import { makeFixId } from "../shared/fix-id";
import { countTextCharacters } from "../shared/text-char-count";
import {
  shouldSuppressChoiceFix,
  syncChoiceResolutionsAfterScan,
} from "./choice-resolution";

export function toFixDto(nodeId: string, fixes: TextFix[]): TextFixDto[] {
  return fixes.map((f) => {
    const rule: RuleInfo = {
      id: f.ruleId,
      category: f.category,
      message: f.message,
      ...(f.hint ? { hint: f.hint } : {}),
      ...(f.hintHtml ? { hintHtml: f.hintHtml } : {}),
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

export function filterUnresolvedChoiceFixes(node: TextNode, fixes: TextFix[]): TextFix[] {
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

export function partitionFixesByPolicy(fixes: TextFix[]): {
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

export function buildCheckedTextLayers(textNodes: TextNode[]): CheckedTextLayerDto[] {
  return textNodes.map((node) => ({
    nodeId: node.id,
    nodeName: node.name,
    characterCount: countTextCharacters(node.characters),
  }));
}

export function buildCheckSummary(
  textNodes: TextNode[],
  partial: Omit<CheckSummary, "checkedLayers">,
): CheckSummary {
  return {
    checkedLayers: textNodes.length,
    ...partial,
  };
}

export function buildCardForNode(
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
