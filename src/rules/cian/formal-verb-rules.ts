import type { AutofixRule } from "../../core/autofix-engine";
import { rowsToAutofixRules } from "../../lexicon/replacement-rows";
import tyVyCuratedRaw from "../../../data/ty-vy-curated.txt?raw";
import { parseTyVyCuratedRows } from "../ty-vy-curated";

const tyVyCuratedRows = parseTyVyCuratedRows(tyVyCuratedRaw);

/** Замена форм обращения «ты» на «вы» по курируемому словарю UI. */
export function buildFormalVerbRules(): AutofixRule[] {
  return rowsToAutofixRules(tyVyCuratedRows, "cian-ty-vy");
}
