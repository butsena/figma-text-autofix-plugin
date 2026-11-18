import { describe, expect, it } from "vitest";
import {
  exportQaManualSession,
  importQaManualSession,
  migrateLegacyQaEntries,
  parseQaManualSession,
  setQaManualStatus
} from "./qa-session-adapter";

const statuses = ["passed", "failed", "not_run", "needs_retest", "processed_legacy"];
const session = {
  schemaVersion: 1,
  exportedAt: "2026-10-23T10:00:00.000Z",
  unsavedSession: false,
  entries: Object.fromEntries(statuses.map((status, i) => [String(i + 1), {
    status,
    comment: `  Комментарий ${status}\nбез потери пробелов  `,
    checkedAt: "2026-10-22T09:00:00.000Z",
    checkedCommit: "ed9781731ad66758fc0ddeac83239e252efa88ca",
    history: [{ status: "failed", checkedCommit: "older", comment: "предыдущая проверка" }],
    attachments: [
      { id: "path", relativePath: `qa/attachments/${i}-path.jpg`, mimeType: "image/jpeg" },
      { id: "inline", relativePath: `qa/attachments/${i}-inline.png`, dataUrl: "data:image/png;base64,AAAA" }
    ]
  }]))
};

describe("QA session adapter (archive format)", () => {
  it("preserves all statuses, dates, commits, history, comments and both attachment forms", () => {
    const imported = importQaManualSession({}, parseQaManualSession(JSON.stringify(session)));
    const exported = exportQaManualSession(imported, "2026-10-23T11:00:00.000Z");
    expect(exported.entries).toEqual(session.entries);
    expect(exported.unsavedSession).toBe(true);
    exported.entries["1"].attachments[0].relativePath = "changed";
    expect(imported["1"].attachments[0].relativePath).toBe("qa/attachments/0-path.jpg");
  });

  it("replaces an incoming not_run entry fully and keeps omitted IDs", () => {
    const current = {
      "1": { status: "passed", comment: "old", attachments: [{ id: "a", relativePath: "old.png" }] },
      "99": { status: "failed", comment: "unrelated" }
    };
    const next = importQaManualSession(current, { ...session, entries: { "1": { status: "not_run" } } });
    expect(next["1"]).toEqual({ status: "not_run" });
    expect(next["99"]).toEqual(current["99"]);
    expect(current["1"].status).toBe("passed");
  });

  it("migrates legacy once without assigning passed or overriding canonical not_run", () => {
    const first = migrateLegacyQaEntries({}, { "1": true }, { "2": "broken" }, {
      "3": [{ id: "shot", src: "data:image/png;base64,AAAA" }]
    });
    expect(first["1"].status).toBe("processed_legacy");
    expect(first["2"].status).toBe("failed");
    expect(first["3"].attachments[0].dataUrl).toContain("data:image/png");
    const canonical = { ...first, "1": { status: "not_run" } };
    expect(migrateLegacyQaEntries(canonical, { "1": true }, {}, {})["1"]).toEqual({ status: "not_run" });
  });

  it("archives the prior result when a person changes status, keeping evidence", () => {
    const previous = session.entries["1"];
    const next = setQaManualStatus(previous, "needs_retest", "2026-10-23", "new-commit");
    expect(next.history).toHaveLength(previous.history.length + 1);
    expect(next.history[next.history.length - 1]).toMatchObject({ status: "passed", checkedCommit: previous.checkedCommit });
    expect(next.attachments).toEqual(previous.attachments);
    expect(next.comment).toBe(previous.comment);
    expect(next.checkedCommit).toBe("new-commit");
    expect(previous.status).toBe("passed");
  });

  it.each([
    { ...session, entries: [] },
    { ...session, entries: { "1": { status: "done" } } },
    { ...session, entries: { "1": { status: "passed", checkedCommit: 123 } } },
    { ...session, entries: { "1": { status: "failed", attachments: [{ id: "a" }] } } },
    { ...session, entries: { "1": { status: "failed", history: [null] } } }
  ])("rejects invalid sessions before import", (invalid) => {
    expect(() => parseQaManualSession(JSON.stringify(invalid))).toThrow();
  });
});
