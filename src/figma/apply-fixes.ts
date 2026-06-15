import type { TextFix } from "../core/autofix-engine";
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

async function loadFontName(font: FontName): Promise<void> {
  await figma.loadFontAsync(font);
}

async function loadFontsForTextNode(textNode: TextNode): Promise<void> {
  const len = textNode.characters.length;
  if (len === 0) {
    const font = textNode.fontName;
    if (font !== figma.mixed) await loadFontName(font);
    return;
  }

  const fontNames = textNode.getRangeAllFontNames(0, len);
  const seen = new Set<string>();

  for (const fontName of fontNames) {
    const key = `${fontName.family}__${fontName.style}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await loadFontName(fontName);
  }
}

/** С конца к началу; при совпадении позиции — выше priority. */
function orderFixesForApply(fixes: TextFix[]): TextFix[] {
  return [...fixes].sort((a, b) => {
    if (a.from !== b.from) return b.from - a.from;
    if (a.to !== b.to) return b.to - a.to;
    return b.priority - a.priority;
  });
}

/**
 * Применить правки посимвольно, сохраняя смешанное форматирование слоя.
 * Индексы fix — относительно текста на момент сканирования; порядок с конца это учитывает.
 */
export async function applyTextFixesToTextNode(
  textNode: TextNode,
  fixes: TextFix[],
): Promise<number> {
  if (fixes.length === 0) return 0;

  await loadFontsForTextNode(textNode);

  let applied = 0;
  for (const fix of orderFixesForApply(fixes)) {
    const current = textNode.characters.slice(fix.from, fix.to);
    if (current !== fix.before || fix.before === fix.after) continue;

    textNode.deleteCharacters(fix.from, fix.to);
    if (fix.after.length > 0) {
      textNode.insertCharacters(fix.from, fix.after);
    }
    applied += 1;
  }

  return applied;
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

    try {
      appliedFixesCount += await applyTextFixesToTextNode(node, fixes);
    } catch (error) {
      console.warn("[text-autofix] failed to apply fixes to layer", nodeId, error);
    }
  }

  return appliedFixesCount;
}
