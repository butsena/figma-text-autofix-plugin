/** Portable QA model (T-046). Kept in src/ so vitest can import without extra config. */

import type { QaManualSession, QaManualStatus } from "./qa-session-adapter";
export type { QaManualAttachment, QaManualEntry, QaManualSession, QaManualStatus } from "./qa-session-adapter";

export type QaAgentStatus = "ok" | "ok-code" | "fixed" | "partial";

export type QaScenario = {
  id: string;
  n: number;
  area: string;
  caseText: string;
  expected: string;
  priority: string;
  definitionVersion: number;
  taskIds: string[];
  prNumbers: number[];
  legacyTaskIds: string[];
};

export type QaAgentResult = {
  scenarioId: string;
  agentStatus: QaAgentStatus;
  agentNote: string;
  checkedAt: string | null;
  commit: string | null;
  method: string;
  environmentNote?: string;
};

export type QaScenariosFile = {
  schemaVersion: 1;
  updatedAt: string;
  sourceCanvas?: string;
  scenarios: QaScenario[];
};

/** Map legacy Canvas done=true → processed_legacy (not Passed). */
export function legacyDoneToManualStatus(done: boolean): QaManualStatus {
  return done ? "processed_legacy" : "not_run";
}

/**
 * When expectation/code for a scenario changes: keep previous manual result in history
 * and mark current check needs_retest. Does not wipe unrelated scenarios.
 */
export function markNeedsRetest(
  session: QaManualSession,
  scenarioId: string,
  reason: string,
  atIso: string,
): QaManualSession {
  const prev = session.entries[scenarioId];
  if (!prev) {
    return {
      ...session,
      entries: {
        ...session.entries,
        [scenarioId]: {
          status: "needs_retest",
          comment: reason,
          checkedAt: atIso,
          history: [],
        },
      },
    };
  }
  const history = [...(prev.history ?? []), { ...prev, archivedAt: atIso, retestReason: reason }];
  return {
    ...session,
    entries: {
      ...session.entries,
      [scenarioId]: {
        status: "needs_retest",
        comment: reason,
        attachments: prev.attachments,
        checkedAt: atIso,
        checkedCommit: prev.checkedCommit ?? null,
        history,
      },
    },
  };
}

export function nextScenarioNumber(scenarios: readonly { n: number }[]): number {
  return scenarios.reduce((max, s) => Math.max(max, s.n), 0) + 1;
}

export function assertStableIdsUnique(scenarios: readonly QaScenario[]): void {
  const ids = new Set<string>();
  const ns = new Set<number>();
  for (const s of scenarios) {
    if (ids.has(s.id)) throw new Error(`duplicate scenario id ${s.id}`);
    if (ns.has(s.n)) throw new Error(`duplicate scenario n ${s.n}`);
    if (String(s.n) !== s.id) {
      // current canvas uses id === String(n); keep that contract
      throw new Error(`id/n mismatch: id=${s.id} n=${s.n}`);
    }
    ids.add(s.id);
    ns.add(s.n);
  }
}

export function resolveLegacyTaskId(
  legacyId: string,
  map: Record<string, string | string[]>,
): string[] {
  const hit = map[legacyId];
  if (!hit) return [];
  return Array.isArray(hit) ? hit : [hit];
}

export function mergeManualSessionRoundTrip(session: QaManualSession): QaManualSession {
  const json = JSON.stringify(session);
  return JSON.parse(json) as QaManualSession;
}
