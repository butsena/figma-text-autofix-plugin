import { escapeHtml } from "../shared/escape-html";
import type {
  LexiconLoadStatusDto,
  LexiconResourceLoadStatus,
} from "../shared/messages";

export type LexStatusTone = "ok" | "warn" | "err";
export type LexStatusBadgeKind = "github" | "bundled" | "partial" | "offline";

export type LexStatusRowModel = {
  title: string;
  detail: string;
  tone: LexStatusTone;
  badge: LexStatusBadgeKind;
};

const BADGE_LABEL: Record<LexStatusBadgeKind, string> = {
  github: "GitHub",
  bundled: "Встроенный",
  partial: "Частично недоступен",
  offline: "Нет связи со словарём",
};

function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const mod10 = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/** «164 000» — пробел как разделитель тысяч (как в макете). */
export function formatLexCount(n: number): string {
  return Math.trunc(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatRulesDetail(count: number): string {
  return `${formatLexCount(count)} ${pluralRu(count, "правило", "правила", "правил")}`;
}

export function formatPhrasesDetail(count: number): string {
  return `${formatLexCount(count)} ${pluralRu(count, "фраза", "фразы", "фраз")}`;
}

export function formatPairsDetail(count: number): string {
  return `${formatLexCount(count)} ${pluralRu(count, "пара", "пары", "пар")}`;
}

export function formatWordsDetail(count: number): string {
  return `${formatLexCount(count)} ${pluralRu(count, "слово", "слова", "слов")}`;
}

function isRemoteOk(resource: LexiconResourceLoadStatus): boolean {
  return resource.ok && resource.fromRemote;
}

/** Ошибки источников для диагностики; в UI не показываются. */
export function collectLexiconErrorMessages(
  ...resources: LexiconResourceLoadStatus[]
): string[] {
  const out: string[] = [];
  for (const resource of resources) {
    const msg = resource.errorMessage?.trim();
    if (msg) out.push(msg);
  }
  return out;
}

function buildBundledEditorialRow(
  title: string,
  resource: LexiconResourceLoadStatus,
  kind: "replacements" | "boundary" | "forms",
): LexStatusRowModel {
  if (kind === "forms") {
    return {
      title,
      detail: `Встроенный список (${formatPairsDetail(resource.count)}), GitHub не загрузился`,
      tone: "warn",
      badge: "bundled",
    };
  }
  return {
    title,
    detail: "Встроенный словарь, GitHub не загрузился",
    tone: "warn",
    badge: "bundled",
  };
}

export function buildEditorialLexStatusRow(
  title: string,
  resource: LexiconResourceLoadStatus,
  kind: "replacements" | "boundary" | "forms",
): LexStatusRowModel {
  if (isRemoteOk(resource)) {
    const detail =
      kind === "replacements"
        ? formatRulesDetail(resource.count)
        : kind === "boundary"
          ? formatPhrasesDetail(resource.count)
          : formatPairsDetail(resource.count);
    return { title, detail, tone: "ok", badge: "github" };
  }
  return buildBundledEditorialRow(title, resource, kind);
}

export function buildDictionaryLexStatusRow(
  resource: LexiconResourceLoadStatus,
): LexStatusRowModel {
  if (isRemoteOk(resource)) {
    return {
      title: "Словарь",
      detail: formatWordsDetail(resource.count),
      tone: "ok",
      badge: "github",
    };
  }
  return {
    title: "Словарь",
    detail: "Проверка недоступна",
    tone: "err",
    badge: "offline",
  };
}

export function buildSpellExceptionsLexStatusRow(
  supplement: LexiconResourceLoadStatus,
  whitelist: LexiconResourceLoadStatus,
  uniqueCount: number,
): LexStatusRowModel {
  const supOk = isRemoteOk(supplement);
  const wlOk = isRemoteOk(whitelist);

  if (supOk && wlOk) {
    return {
      title: "Слова-исключения",
      detail: formatWordsDetail(uniqueCount),
      tone: "ok",
      badge: "github",
    };
  }
  if (!supOk && !wlOk) {
    return {
      title: "Слова-исключения",
      detail: "Встроенные списки, GitHub не загрузился",
      tone: "warn",
      badge: "bundled",
    };
  }
  return {
    title: "Слова-исключения",
    detail: "Не все загрузились",
    tone: "warn",
    badge: "partial",
  };
}

export function buildTechLexiconStatusRows(
  lex: LexiconLoadStatusDto,
  includeSpell: boolean,
): LexStatusRowModel[] {
  const rows: LexStatusRowModel[] = [
    buildEditorialLexStatusRow("Замены", lex.replacements, "replacements"),
    buildEditorialLexStatusRow("Без точки", lex.boundaryExceptions, "boundary"),
    buildEditorialLexStatusRow("Формы слов", lex.ambiguousFormChoices, "forms"),
  ];
  if (!includeSpell) return rows;
  rows.push(buildDictionaryLexStatusRow(lex.spellDictionary));
  const unique =
    lex.spellExtraUniqueCount ??
    lex.spellSupplement.count + lex.spellWhitelist.count;
  rows.push(
    buildSpellExceptionsLexStatusRow(lex.spellSupplement, lex.spellWhitelist, unique),
  );
  return rows;
}

const ICON_GITHUB = `<svg class="lexStatusBadgeSvg" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>`;

const ICON_DB = `<svg class="lexStatusBadgeSvg" viewBox="0 0 16 16" aria-hidden="true"><ellipse cx="8" cy="3.5" rx="5.5" ry="2.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 3.5v9c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2v-9" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 8c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;

const ICON_WARN = `<svg class="lexStatusBadgeSvg" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8.87 1.5a1 1 0 0 0-1.74 0L1.2 12.2A1 1 0 0 0 2.07 13.7h11.86a1 1 0 0 0 .87-1.5L8.87 1.5zM8 5.2c.35 0 .62.3.6.65l-.25 3.4a.35.35 0 0 1-.7 0l-.25-3.4A.61.61 0 0 1 8 5.2zm0 6.3a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z"/></svg>`;

function badgeIcon(kind: LexStatusBadgeKind): string {
  if (kind === "github") return ICON_GITHUB;
  if (kind === "offline") return ICON_WARN;
  return ICON_DB;
}

export function formatLexStatusRowHtml(row: LexStatusRowModel): string {
  const badgeClass =
    row.badge === "offline" ? "lexStatusBadge lexStatusBadge--err" : "lexStatusBadge";
  return `<div class="lexStatusRow lexStatusRow--${row.tone}">
  <span class="lexStatusDot" aria-hidden="true"></span>
  <div class="lexStatusCopy">
    <div class="lexStatusTitle">${escapeHtml(row.title)}</div>
    <div class="lexStatusDetail">${escapeHtml(row.detail)}</div>
  </div>
  <div class="${badgeClass}">
    ${badgeIcon(row.badge)}
    <span class="lexStatusBadgeLabel">${escapeHtml(BADGE_LABEL[row.badge])}</span>
  </div>
</div>`;
}

export function formatTechLexiconStatusBodyHtml(
  lex: LexiconLoadStatusDto,
  includeSpell: boolean,
): string {
  return buildTechLexiconStatusRows(lex, includeSpell).map(formatLexStatusRowHtml).join("");
}
