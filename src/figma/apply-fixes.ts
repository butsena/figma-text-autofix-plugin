import { applyTextFixes, type TextFix } from "../core/autofix-engine";
import type { CheckResultDto, TextFixDto } from "../shared/messages";

function toEngineTextFix(f: TextFixDto): TextFix {
  return {
    from: f.from,
    to: f.to,
    before: f.before,
    after: f.after,
    ruleId: f.rule.id,
    category: f.rule.category,
    message: f.rule.message,
    priority: f.rule.priority,
  };
}

async function loadFontsForTextNode(textNode: TextNode): Promise<void> {
  const fontNames = textNode.getRangeAllFontNames(0, textNode.characters.length);
  const seen = new Set<string>();

  for (const fontName of fontNames) {
    const key = `${fontName.family}__${fontName.style}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await figma.loadFontAsync(fontName);
  }
}

/** Применить все правки из снимка сканирования к текстовым слоям. */
export async function applyFixesFromScan(result: CheckResultDto): Promise<number> {
  const fixByNodeId = new Map<string, TextFix[]>();

  for (const card of result.cards) {
    for (const fix of card.fixes) {
      const list = fixByNodeId.get(card.nodeId) ?? [];
      list.push(toEngineTextFix(fix));
      fixByNodeId.set(card.nodeId, list);
    }
  }

  let appliedFixesCount = 0;
  for (const [nodeId, fixes] of fixByNodeId.entries()) {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node || node.type !== "TEXT") continue;

    const textNode = node;
    await loadFontsForTextNode(textNode);
    const currentText = textNode.characters;
    const newText = applyTextFixes(currentText, fixes);
    if (newText === currentText) continue;
    textNode.characters = newText;
    appliedFixesCount += fixes.length;
  }

  return appliedFixesCount;
}
