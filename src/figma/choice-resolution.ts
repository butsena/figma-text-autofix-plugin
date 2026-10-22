export type {
  ChoiceFixPosition,
  ChoiceResolution,
} from "./choice-resolution-core";

export { beginPluginRun, MAX_SPELL_SKIP_COUNT } from "./choice-skip-session";

export {
  buildChoiceAnchors,
  createChoiceResolution,
  findChosenWordNear,
  findResolutionPositions,
  isChoiceResolution,
  pruneStaleResolutions,
  readChoiceResolutionsFromPluginData,
  reanchorResolution,
  shouldSuppressChoiceFix,
  stripInvalidatedResolutionsForFixes,
  upsertChoiceResolution,
  applySkipToResolutions,
} from "./choice-resolution-core";

import {
  createChoiceResolution,
  pruneStaleResolutions,
  readChoiceResolutionsFromPluginData,
  stripInvalidatedResolutionsForFixes,
  upsertChoiceResolution,
  applySkipToResolutions,
  type ChoiceFixPosition,
  type ChoiceResolution,
} from "./choice-resolution-core";

export const CHOICE_RESOLUTIONS_PLUGIN_KEY = "text-autofix:choice-resolutions";

export function readChoiceResolutions(node: TextNode): ChoiceResolution[] {
  return readChoiceResolutionsFromPluginData(node.getPluginData(CHOICE_RESOLUTIONS_PLUGIN_KEY));
}

export function writeChoiceResolutions(node: TextNode, resolutions: ChoiceResolution[]): void {
  if (resolutions.length === 0) {
    node.setPluginData(CHOICE_RESOLUTIONS_PLUGIN_KEY, "");
    return;
  }
  node.setPluginData(CHOICE_RESOLUTIONS_PLUGIN_KEY, JSON.stringify(resolutions));
}

export function getActiveChoiceResolutions(node: TextNode): ChoiceResolution[] {
  const text = node.characters;
  const stored = readChoiceResolutions(node);
  const pruned = pruneStaleResolutions(text, stored);
  if (JSON.stringify(pruned) !== JSON.stringify(stored)) {
    writeChoiceResolutions(node, pruned);
  }
  return pruned;
}

export function syncChoiceResolutionsAfterScan(
  node: TextNode,
  fixes: ChoiceFixPosition[],
): ChoiceResolution[] {
  const text = node.characters;
  const active = getActiveChoiceResolutions(node);
  const stripped = stripInvalidatedResolutionsForFixes(text, fixes, active);
  if (stripped.length !== active.length) {
    writeChoiceResolutions(node, stripped);
  }
  return stripped;
}

export function recordChoiceResolutionOnNode(
  node: TextNode,
  text: string,
  fix: ChoiceFixPosition & { chosen: string },
): void {
  const resolution = createChoiceResolution(
    text,
    fix.ruleId,
    fix.from,
    fix.to,
    fix.before,
    fix.chosen,
  );
  const active = pruneStaleResolutions(text, readChoiceResolutions(node));
  writeChoiceResolutions(node, upsertChoiceResolution(active, resolution));
}

/** «Пропустить» орфографию: +1 запуск; после MAX_SPELL_SKIP_COUNT больше не показывать. */
export function recordSpellSkipOnNode(node: TextNode, fix: ChoiceFixPosition): void {
  const text = node.characters;
  const active = pruneStaleResolutions(text, readChoiceResolutions(node));
  writeChoiceResolutions(node, applySkipToResolutions(text, fix, active));
}
