#!/usr/bin/env node
/**
 * Extract ITEMS from the live manual-qa-checklist canvas into qa/scenarios.json.
 * Does not read Canvas runtime state (done/broken/shots) — that requires user export.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const LIVE_CANVAS =
  process.env.QA_CANVAS_PATH ||
  "/Users/a.butsenko/.cursor/projects/Users-a-butsenko-Desktop-figma-text-autofix-plugin/canvases/manual-qa-checklist.canvas.tsx";
const REPO_CANVAS = path.join(ROOT, "qa/canvas/manual-qa-checklist.canvas.tsx");
const CANVAS = fs.existsSync(LIVE_CANVAS) ? LIVE_CANVAS : REPO_CANVAS;
const OUT = path.join(ROOT, "qa", "scenarios.json");

function unquote(s) {
  if (s.startsWith("`")) {
    return s
      .slice(1, -1)
      .replace(/\\`/g, "`")
      .replace(/\\n/g, "\n")
      .replace(/\\\$/g, "$")
      .replace(/\\\\/g, "\\");
  }
  return JSON.parse(s);
}

const canvas = fs.readFileSync(CANVAS, "utf8");
const m = canvas.match(/const ITEMS: Item\[\] = (\[[\s\S]*?\n\]);/);
if (!m) throw new Error("ITEMS array not found in canvas");

const itemRe =
  /\{\s*id:\s*"([^"]+)",\s*n:\s*(\d+),\s*area:\s*"([^"]+)",\s*caseText:\s*("(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`),\s*expected:\s*("(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`),\s*priority:\s*"([^"]+)",\s*agentStatus:\s*"([^"]+)",\s*agentNote:\s*("(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`),?\s*\}/g;

/** @type {import('../qa/types.js').QaScenario[]} */
const scenarios = [];
let match;
while ((match = itemRe.exec(m[1]))) {
  const [, id, n, area, caseText, expected, priority, agentStatus, agentNote] = match;
  scenarios.push({
    id,
    n: Number(n),
    area,
    caseText: unquote(caseText),
    expected: unquote(expected),
    priority,
    definitionVersion: 1,
    taskIds: [],
    prNumbers: [],
    legacyTaskIds: [],
  });
  // agent fields go to agent-results separately in migrate step
  scenarios[scenarios.length - 1]._agentStatus = agentStatus;
  scenarios[scenarios.length - 1]._agentNote = unquote(agentNote);
}

if (!scenarios.length) throw new Error("No ITEMS parsed");

fs.mkdirSync(path.dirname(OUT), { recursive: true });

const prevScenarios = fs.existsSync(OUT)
  ? JSON.parse(fs.readFileSync(OUT, "utf8")).scenarios || []
  : [];
const prevById = new Map(prevScenarios.map((s) => [s.id, s]));

const agentPath = path.join(ROOT, "qa", "agent-results.json");
const prevAgent = fs.existsSync(agentPath)
  ? JSON.parse(fs.readFileSync(agentPath, "utf8")).results || []
  : [];
const prevAgentById = new Map(prevAgent.map((r) => [r.scenarioId, r]));

const agentResults = scenarios.map((s) => {
  const { _agentStatus, _agentNote, ...def } = s;
  const prev = prevAgentById.get(def.id);
  return {
    scenarioId: def.id,
    agentStatus: _agentStatus,
    agentNote: _agentNote,
    checkedAt: prev?.checkedAt ?? null,
    commit: prev?.commit ?? null,
    method:
      prev?.method ??
      (_agentStatus === "ok" ? "engine-test" : _agentStatus === "ok-code" ? "code-review" : "other"),
    environmentNote:
      prev?.environmentNote ??
      "Migrated from canvas ITEMS agentStatus/agentNote (13.10.2026). Not a live Figma run unless noted.",
  };
});

const clean = scenarios.map(({ _agentStatus, _agentNote, ...def }) => {
  const prev = prevById.get(def.id);
  // Best-effort legacy task ids from agentNote like "qa-1" / "→ бэклог qa-*"
  const legacy = [...(prev?.legacyTaskIds || [])];
  const note = _agentNote || "";
  for (const hit of note.matchAll(/\bqa-(\d+)\b/g)) legacy.push(`qa-${hit[1]}`);
  for (const hit of note.matchAll(/\b(ne-1|spell-\d+[a-z]?|tech-1|layout-\d+|copy-\d+|dict-\d+[a-z]?|analytics-\d+[a-z]?|remote-lists-\d+[a-z]?|lexicon-\d+|tov-\d+|pipeline-[\w-]+)\b/g)) {
    legacy.push(hit[1]);
  }
  return {
    ...def,
    definitionVersion: prev?.definitionVersion ?? 1,
    taskIds: prev?.taskIds ?? [],
    prNumbers: prev?.prNumbers ?? [],
    legacyTaskIds: [...new Set(legacy)],
  };
});

const payload = {
  schemaVersion: 1,
  updatedAt: new Date().toISOString().slice(0, 10),
  sourceCanvas: CANVAS,
  scenarios: clean,
};

fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
fs.writeFileSync(
  agentPath,
  JSON.stringify({ schemaVersion: 1, results: agentResults }, null, 2) + "\n",
);

console.log(
  `[qa-extract] ${clean.length} scenarios → qa/scenarios.json; agent notes → qa/agent-results.json`,
);
console.log(`[qa-extract] max n=${Math.max(...clean.map((s) => s.n))}`);
console.log(
  "[qa-extract] Live Canvas state (done/broken/shots) was NOT read — use canvas Export session.",
);
