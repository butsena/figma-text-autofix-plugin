import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertStableIdsUnique,
  legacyDoneToManualStatus,
  markNeedsRetest,
  mergeManualSessionRoundTrip,
  nextScenarioNumber,
  resolveLegacyTaskId,
  type QaManualSession,
  type QaScenariosFile,
} from "./qa-model";

const ROOT = resolve(import.meta.dirname, "../..");

describe("qa portable model (T-046)", () => {
  const scenariosFile = JSON.parse(
    readFileSync(resolve(ROOT, "qa/scenarios.json"), "utf8"),
  ) as QaScenariosFile;
  const legacyMap = JSON.parse(
    readFileSync(resolve(ROOT, "qa/legacy-id-map.json"), "utf8"),
  ) as { map: Record<string, string | string[]> };

  it("keeps stable unique id/n from migration", () => {
    expect(scenariosFile.scenarios.length).toBe(60);
    assertStableIdsUnique(scenariosFile.scenarios);
    expect(nextScenarioNumber(scenariosFile.scenarios)).toBe(61);
    expect(scenariosFile.scenarios.find((s) => s.id === "59")?.taskIds).toEqual(["T-140", "T-144"]);
    expect(scenariosFile.scenarios.find((s) => s.id === "60")?.taskIds).toEqual(["T-144"]);
    const portable = scenariosFile.scenarios.find((s) => s.id === "55");
    expect(portable?.taskIds).toEqual(["T-046", "T-139"]);
    expect(portable?.legacyTaskIds).toContain("pipeline-qa");
  });

  it("maps known legacy YAML ids; unknown stay empty (not invented)", () => {
    expect(resolveLegacyTaskId("tech-1", legacyMap.map)).toEqual(["T-085"]);
    expect(resolveLegacyTaskId("pipeline-qa", legacyMap.map)).toEqual(["T-046"]);
    expect(resolveLegacyTaskId("qa-1", legacyMap.map)).toEqual([]);
  });

  it("does not turn legacy done into Passed", () => {
    expect(legacyDoneToManualStatus(true)).toBe("processed_legacy");
    expect(legacyDoneToManualStatus(false)).toBe("not_run");
  });

  it("needs_retest preserves previous manual result in history", () => {
    const session: QaManualSession = {
      schemaVersion: 1,
      exportedAt: "2026-10-13T00:00:00.000Z",
      unsavedSession: true,
      entries: {
        "14": {
          status: "failed",
          comment: "плашка старая",
          checkedAt: "2026-10-01",
          history: [],
        },
      },
    };
    const next = markNeedsRetest(session, "14", "changed expected copy", "2026-10-13T12:00:00.000Z");
    expect(next.entries["14"]?.status).toBe("needs_retest");
    expect(next.entries["14"]?.history).toHaveLength(1);
    expect((next.entries["14"]?.history?.[0] as { status: string }).status).toBe("failed");
    expect(next.entries["14"]?.comment).toContain("changed expected");
    // unrelated empty
    expect(next.entries["1"]).toBeUndefined();
  });

  it("manual session JSON round-trip keeps comments and attachment paths", () => {
    const session: QaManualSession = {
      schemaVersion: 1,
      exportedAt: "2026-10-13T00:00:00.000Z",
      unsavedSession: false,
      entries: {
        "7": {
          status: "failed",
          comment: "скрин вложения",
          attachments: [{ id: "a1", relativePath: "qa/attachments/7-a1.png" }],
        },
      },
    };
    const back = mergeManualSessionRoundTrip(session);
    expect(back).toEqual(session);
  });

  it("agent results are separate from manual statuses", () => {
    const agent = JSON.parse(readFileSync(resolve(ROOT, "qa/agent-results.json"), "utf8")) as {
      results: Array<{ scenarioId: string; agentStatus: string }>;
    };
    expect(agent.results.map((r) => r.scenarioId).sort()).toEqual(
      scenariosFile.scenarios.map((s) => s.id).sort(),
    );
    expect(agent.results.every((r) => r.scenarioId && r.agentStatus)).toBe(true);
    // file must not claim manual Passed
    const raw = readFileSync(resolve(ROOT, "qa/agent-results.json"), "utf8");
    expect(raw).not.toMatch(/"status":\s*"passed"/);
  });
});
