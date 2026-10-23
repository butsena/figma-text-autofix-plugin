/** Standalone source embedded into the Canvas by qa:sync-canvas. No runtime imports. */
export type QaManualStatus =
  | "passed"
  | "failed"
  | "not_run"
  | "needs_retest"
  | "processed_legacy";

export type QaManualAttachment = {
  id: string;
  relativePath: string;
  mimeType?: string;
  dataUrl?: string;
};

export type QaManualEntry = {
  status: QaManualStatus;
  comment?: string;
  attachments?: QaManualAttachment[];
  checkedAt?: string | null;
  checkedCommit?: string | null;
  history?: unknown[];
};

export type QaManualSession = {
  schemaVersion: 1;
  exportedAt: string;
  canvasPath?: string;
  unsavedSession?: boolean;
  entries: Record<string, QaManualEntry>;
};

const QA_MANUAL_STATUSES: readonly QaManualStatus[] = [
  "passed", "failed", "not_run", "needs_retest", "processed_legacy",
];

function isQaRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneQaValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Validate all entries before applying any of them. Keep optional metadata intact. */
export function parseQaManualSession(raw: string): QaManualSession {
  const parsed: unknown = JSON.parse(raw);
  if (!isQaRecord(parsed) || parsed.schemaVersion !== 1 ||
      typeof parsed.exportedAt !== "string" || !isQaRecord(parsed.entries)) {
    throw new Error("Нужны schemaVersion=1, exportedAt и объект entries.");
  }
  for (const [id, entry] of Object.entries(parsed.entries)) {
    if (!isQaRecord(entry) ||
        !QA_MANUAL_STATUSES.includes(entry.status as QaManualStatus)) {
      throw new Error(`Сценарий ${id}: неизвестный статус.`);
    }
    if ((entry.comment !== undefined && typeof entry.comment !== "string") ||
        (entry.checkedAt !== undefined && entry.checkedAt !== null && typeof entry.checkedAt !== "string") ||
        (entry.checkedCommit !== undefined && entry.checkedCommit !== null && typeof entry.checkedCommit !== "string") ||
        (entry.history !== undefined && (!Array.isArray(entry.history) || !entry.history.every(isQaRecord)))) {
      throw new Error(`Сценарий ${id}: неверные метаданные проверки.`);
    }
    if (entry.attachments !== undefined && (!Array.isArray(entry.attachments) ||
        !entry.attachments.every((a) => isQaRecord(a) && typeof a.id === "string" &&
          typeof a.relativePath === "string" &&
          (a.dataUrl === undefined || typeof a.dataUrl === "string") &&
          (a.mimeType === undefined || typeof a.mimeType === "string")))) {
      throw new Error(`Сценарий ${id}: неверные вложения.`);
    }
  }
  return parsed as QaManualSession;
}

/** Incoming entries replace those IDs, including not_run; omitted IDs stay intact. */
export function importQaManualSession(
  current: Record<string, QaManualEntry>,
  session: QaManualSession,
): Record<string, QaManualEntry> {
  return cloneQaValue({ ...current, ...session.entries });
}

export function exportQaManualSession(
  entries: Record<string, QaManualEntry>,
  exportedAt: string,
  canvasPath?: string,
): QaManualSession {
  return cloneQaValue({
    schemaVersion: 1 as const,
    exportedAt,
    ...(canvasPath ? { canvasPath } : {}),
    unsavedSession: true,
    entries,
  });
}

/** Existing canonical entries win. Legacy maps never manufacture a manual passed. */
export function migrateLegacyQaEntries(
  entries: Record<string, QaManualEntry>,
  done: Record<string, boolean>,
  comments: Record<string, string>,
  shots: Record<string, Array<{ id: string; src: string }>>,
): Record<string, QaManualEntry> {
  const next = { ...entries };
  const ids = new Set([...Object.keys(done), ...Object.keys(comments), ...Object.keys(shots)]);
  for (const id of ids) {
    if (Object.prototype.hasOwnProperty.call(next, id)) continue;
    const comment = comments[id] ?? "";
    const attachments = (shots[id] ?? []).map((shot) => ({
      id: shot.id,
      relativePath: `qa/attachments/${id}-${shot.id}.png`,
      dataUrl: shot.src,
    }));
    next[id] = {
      status: comment.trim() || attachments.length ? "failed" : done[id] ? "processed_legacy" : "not_run",
      comment,
      attachments,
      checkedAt: null,
      checkedCommit: null,
      history: [],
    };
  }
  return next;
}

/** Called only by an explicit status action in the Canvas. */
export function setQaManualStatus(
  previous: QaManualEntry | undefined,
  status: QaManualStatus,
  checkedAt: string,
  checkedCommit?: string | null,
): QaManualEntry {
  const current = previous ?? { status: "not_run" as const };
  if (current.status === status) return current;
  const { history = [], ...snapshot } = current;
  return {
    ...current,
    status,
    checkedAt,
    checkedCommit: checkedCommit === undefined ? current.checkedCommit ?? null : checkedCommit,
    history: previous ? [...history, { ...snapshot, archivedAt: checkedAt }] : history,
  };
}
