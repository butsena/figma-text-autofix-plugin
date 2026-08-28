export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && c === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

/** Строки CSV без пустых и комментариев (#). */
export function parseCsvRows(raw: string): string[][] {
  const rows: string[][] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    rows.push(parseCsvLine(line));
  }
  return rows;
}

function normHeader(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function headerColIndex(header: string[], aliases: string[]): number {
  const h = header.map(normHeader);
  for (const a of aliases) {
    const i = h.indexOf(normHeader(a));
    if (i >= 0) return i;
  }
  return -1;
}

export function isEnabledCell(cell: string): boolean {
  const v = cell.trim().toLowerCase();
  return v === "yes" || v === "true" || v === "1" || v === "да";
}
