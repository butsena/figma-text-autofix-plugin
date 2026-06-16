import { parseCsvRows } from "../sheet/csv";
import type { SheetReplacementRow } from "../sheet/replacement-rows";
import { MSG_RED_POLICY_TY_VY_VERB } from "./rule-messages";

function splitVariantList(cell: string): string[] {
  return cell
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Строки `ty-vy-curated.txt`: исходная_форма,верная_форма (или "a, b",цель). */
export function parseTyVyCuratedRows(raw: string): SheetReplacementRow[] {
  const rows = parseCsvRows(raw);
  const out: SheetReplacementRow[] = [];

  for (const row of rows) {
    if (row.length < 2) continue;

    const variants = splitVariantList(row[0]);
    const replace = row[1].trim();
    if (variants.length === 0 || !replace) continue;

    out.push({
      variants,
      replace,
      message: MSG_RED_POLICY_TY_VY_VERB,
      category: "cian_editorial",
      priority: 59,
    });
  }

  return out;
}
