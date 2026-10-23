import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { transformSync } from "esbuild";
import { describe, expect, it } from "vitest";
import {
  exportQaManualSession,
  importQaManualSession,
  migrateLegacyQaEntries,
  parseQaManualSession,
  setQaManualStatus
} from "./qa-session-adapter";
const ROOT = resolve(import.meta.dirname, "../..");
const statuses = ["passed", "failed", "not_run", "needs_retest", "processed_legacy"];
const session = {
  schemaVersion: 1,
  exportedAt: "2026-10-23T10:00:00.000Z",
  unsavedSession: false,
  entries: Object.fromEntries(statuses.map((status, i) => [String(i + 1), {
    status,
    comment: `  \u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 ${status}
\u0431\u0435\u0437 \u043F\u043E\u0442\u0435\u0440\u0438 \u043F\u0440\u043E\u0431\u0435\u043B\u043E\u0432  `,
    checkedAt: "2026-10-22T09:00:00.000Z",
    checkedCommit: "ed9781731ad66758fc0ddeac83239e252efa88ca",
    history: [{ status: "failed", checkedCommit: "older", comment: "\u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430" }],
    attachments: [
      { id: "path", relativePath: `qa/attachments/${i}-path.jpg`, mimeType: "image/jpeg" },
      { id: "inline", relativePath: `qa/attachments/${i}-inline.png`, dataUrl: "data:image/png;base64,AAAA" }
    ]
  }]))
};
describe("Canvas QA session adapter", () => {
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
function canvasHarness(initial) {
  const state = new Map(Object.entries(initial));
  const actions = [];
  const source = readFileSync(resolve(ROOT, "qa/canvas/manual-qa-checklist.canvas.tsx"), "utf8");
  const code = transformSync(source, { loader: "tsx", format: "cjs", jsxFactory: "jsx" }).code;
  const exports = {};
  const module = { exports };
  const components = Object.fromEntries(["Button", "Callout", "H1", "H2", "IconButton", "Pill", "Row", "Spacer", "Stack", "Stat", "Table", "Text", "TextArea"].map((name) => [name, name]));
  runInNewContext(code, {
    module,
    exports,
    require: () => ({
      ...components,
      useCanvasState: (key, fallback) => {
        if (!state.has(key)) state.set(key, fallback);
        return [state.get(key), (value) => state.set(key, typeof value === "function" ? value(state.get(key)) : value)];
      },
      useCanvasAction: () => (action) => actions.push(action),
      useHostTheme: () => ({ accent: { primary: "blue" }, text: { primary: "black", secondary: "gray" } })
    }),
    jsx: (type, props, ...children) => ({ type, props: { ...props, children } })
  });
  const render = () => {
    const all = [];
    const walk = (value) => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") {
        if (value.type && value.props) all.push(value);
        Object.values(value).forEach(walk);
      }
    };
    walk(module.exports.default());
    return all;
  };
  return { state, actions, render };
}
describe("actual Canvas import / export controls", () => {
  it("transfers only current failed cases; old evidence does not reopen accepted cases", () => {
    const harness = canvasHarness({
      "manual-entries-v1": {
        "1": { status: "passed", comment: "\u0441\u0442\u0430\u0440\u043E\u0435 \u0437\u0430\u043C\u0435\u0447\u0430\u043D\u0438\u0435", attachments: [{ id: "old", relativePath: "qa/attachments/old.png" }] },
        "2": { status: "needs_retest", comment: "\u043F\u0435\u0440\u0435\u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0441\u0442\u0430\u0440\u044B\u0439 \u0431\u0430\u0433" }
      }
    });
    const backlogButton = () => harness.render().find((e) => e.type === "Button" && e.props.children.includes("\u0412 \u0431\u044D\u043A\u043B\u043E\u0433"));
    expect(backlogButton().props.disabled).toBe(true);
    harness.state.set("manual-entries-v1", {
      ...harness.state.get("manual-entries-v1"),
      "3": { status: "failed" }
    });
    expect(backlogButton().props.disabled).toBe(false);
    backlogButton().props.onClick();
    expect(harness.actions).toHaveLength(1);
    expect(harness.actions[0].type).toBe("newComposerChat");
    expect(harness.actions[0].userPrompt).toContain("\u0442\u0435\u043A\u0443\u0449\u0438\u043C \u0440\u0443\u0447\u043D\u044B\u043C \u0441\u0442\u0430\u0442\u0443\u0441\u043E\u043C failed");
    expect(harness.actions[0].userPrompt).toContain("\u0434\u0430\u0436\u0435 \u0435\u0441\u043B\u0438 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u0438 \u0432\u043B\u043E\u0436\u0435\u043D\u0438\u044F \u043F\u043E\u043A\u0430 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442");
    expect(harness.actions[0].userPrompt).toContain("\u041D\u0435 \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0438 passed, needs_retest, not_run \u0438\u043B\u0438 processed_legacy");
    expect(harness.actions[0].userPrompt).toContain("\u0443\u0442\u043E\u0447\u043D\u0438 \u043D\u0430\u0431\u043B\u044E\u0434\u0430\u0435\u043C\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0438 \u0448\u0430\u0433\u0438 \u0443 \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0430; \u043D\u0435 \u0432\u044B\u0434\u0443\u043C\u044B\u0432\u0430\u0439");
  });
  it("uses the generated adapter, preserving metadata and resetting not_run over legacy done", () => {
    const source = readFileSync(resolve(ROOT, "src/qa/qa-session-adapter.ts"), "utf8").replace(/^export /gm, "").trimEnd();
    const canvas = readFileSync(resolve(ROOT, "qa/canvas/manual-qa-checklist.canvas.tsx"), "utf8");
    expect(canvas).toContain(`// BEGIN GENERATED QA SESSION ADAPTER
${source}
// END GENERATED QA SESSION ADAPTER`);
    const harness = canvasHarness({
      "session-panel-v1": "import",
      "session-import-v1": JSON.stringify(session),
      "done-v6": { "3": true, "99": true },
      "manual-entries-v1": { "1": { status: "failed", comment: "stale" } }
    });
    const apply = harness.render().find((e) => e.type === "Button" && e.props.children.includes("\u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C \u0438\u043C\u043F\u043E\u0440\u0442"));
    expect(apply).toBeDefined();
    apply.props.onClick();
    harness.state.set("session-panel-v1", "export");
    const exportedField = harness.render().find((e) => e.type === "TextArea" && typeof e.props.value === "string" && e.props.value.startsWith('{\n  "schemaVersion"'));
    const exported = JSON.parse(exportedField.props.value);
    expect(exported.entries).toMatchObject(session.entries);
    expect(exported.entries["3"].status).toBe("not_run");
    expect(exported.entries["99"].status).toBe("processed_legacy");
    expect(exported.entries["1"].attachments).toEqual(session.entries["1"].attachments);
    expect(harness.render().find((e) => e.type === "select" && e.props["aria-label"] === "\u0421\u0442\u0430\u0442\u0443\u0441 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u044F 3").props.value).toBe("not_run");
  });
  it("does not partially import invalid records", () => {
    const original = { "1": { status: "passed", comment: "keep" } };
    const harness = canvasHarness({
      "session-panel-v1": "import",
      "session-import-v1": JSON.stringify({ ...session, entries: { "1": { status: "failed" }, "2": { status: "invalid" } } }),
      "manual-entries-v1": original
    });
    harness.render().find((e) => e.type === "Button" && e.props.children.includes("\u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C \u0438\u043C\u043F\u043E\u0440\u0442")).props.onClick();
    expect(harness.state.get("manual-entries-v1")).toEqual(original);
    expect(harness.state.get("session-msg-v1")).toContain("\u0418\u043C\u043F\u043E\u0440\u0442 \u043E\u0442\u043A\u043B\u043E\u043D\u0451\u043D");
  });
});
