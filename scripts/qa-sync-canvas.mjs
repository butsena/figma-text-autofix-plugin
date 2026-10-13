#!/usr/bin/env node
/**
 * Regenerate ITEMS in the QA canvas from qa/scenarios.json + qa/agent-results.json.
 * Writes the repo shell copy under qa/canvas/, then mirrors to the live Cursor canvas path.
 * Canvas cannot import repo files — this keeps a single definition source in qa/.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const REPO_CANVAS = path.join(ROOT, "qa/canvas/manual-qa-checklist.canvas.tsx");
const LIVE_CANVAS =
  process.env.QA_CANVAS_PATH ||
  "/Users/a.butsenko/.cursor/projects/Users-a-butsenko-Desktop-figma-text-autofix-plugin/canvases/manual-qa-checklist.canvas.tsx";

function tsString(s) {
  if (s.includes("\n") || s.includes("`") || s.includes("${")) {
    const escaped = s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
    return `\`${escaped}\``;
  }
  return JSON.stringify(s);
}

function writeItems(canvasPath, body) {
  if (!fs.existsSync(canvasPath)) {
    throw new Error(`Canvas not found: ${canvasPath}`);
  }
  const canvas = fs.readFileSync(canvasPath, "utf8");
  const re = /const ITEMS: Item\[\] = \[[\s\S]*?\n\];/;
  if (!re.test(canvas)) throw new Error(`ITEMS array not found in ${canvasPath}`);
  const next = canvas.replace(re, `const ITEMS: Item[] = [\n${body},\n];`);
  if (next !== canvas) fs.writeFileSync(canvasPath, next);
  return next !== canvas;
}

const scenarios = JSON.parse(fs.readFileSync(path.join(ROOT, "qa/scenarios.json"), "utf8"));
const agentDoc = JSON.parse(fs.readFileSync(path.join(ROOT, "qa/agent-results.json"), "utf8"));
const agentById = new Map(agentDoc.results.map((r) => [r.scenarioId, r]));

const items = [...scenarios.scenarios].sort((a, b) => a.n - b.n);
const body = items
  .map((s) => {
    const ag = agentById.get(s.id) || {
      agentStatus: "ok-code",
      agentNote: "",
    };
    return `  {
    id: ${JSON.stringify(s.id)},
    n: ${s.n},
    area: ${JSON.stringify(s.area)},
    caseText: ${tsString(s.caseText)},
    expected: ${tsString(s.expected)},
    priority: ${JSON.stringify(s.priority)},
    agentStatus: ${JSON.stringify(ag.agentStatus)},
    agentNote: ${tsString(ag.agentNote || "")},
  }`;
  })
  .join(",\n");

const changed = writeItems(REPO_CANVAS, body);
console.log(
  `[qa-sync-canvas] ${changed ? "wrote" : "unchanged"} ${items.length} ITEMS → ${REPO_CANVAS}`,
);

try {
  fs.mkdirSync(path.dirname(LIVE_CANVAS), { recursive: true });
  fs.copyFileSync(REPO_CANVAS, LIVE_CANVAS);
  console.log(`[qa-sync-canvas] mirrored → ${LIVE_CANVAS}`);
} catch (err) {
  console.warn(
    `[qa-sync-canvas] live canvas mirror skipped (${err.code || err.message}). Repo copy is authoritative; copy manually if needed.`,
  );
}
