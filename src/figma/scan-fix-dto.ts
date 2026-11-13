import type { TextFix } from "../core/autofix-engine";
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

const TEXT_CONTAINER_TYPES = new Set(["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE"]);

type NamedParent = {
  type: string;
  name: string;
  parent?: NamedParent | null;
};

/** Имя ближайшего фрейма или компонента. Если текста лежит прямо на странице — имя самого слоя. */
export function containingFrameName(node: { name: string; parent?: NamedParent | null }): string {
  let current = node.parent ?? null;
  while (current) {
    if (TEXT_CONTAINER_TYPES.has(current.type)) {
      const name = current.name.trim();
      if (name) return name;
    }
    current = current.parent ?? null;
  }
  return node.name.trim() || "Без имени";
}

/** Длиннее этого в таблице показывается имя фрейма, полный текст в панель не шлём. */
const CHECKED_LAYER_TEXT_MAX = 25;

export function buildCheckedTextLayers(textNodes: TextNode[]): CheckedTextLayerDto[] {
  return textNodes.map((node) => {
    const text = node.characters;
    const characterCount = countTextCharacters(text);
    return {
      nodeId: node.id,
      nodeName: node.name,
      characterCount,
      ...(characterCount <= CHECKED_LAYER_TEXT_MAX ? { text } : {}),
      frameName: containingFrameName(node),
    };
  });
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
): TextNodeCardDto | null {
  if (!fixes.length) return null;

  const originalText = node.characters;

  return {
    nodeId: node.id,
    nodeName: node.name,
    originalText,
    characterCount: countTextCharacters(originalText),
    frameName: containingFrameName(node),
    fixes: toFixDto(node.id, fixes),
  };
}
