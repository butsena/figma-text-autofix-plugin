# QA inventory · 13.10.2026 (T-046)

## Source

- Canvas (definitions): `/Users/a.butsenko/.cursor/projects/Users-a-butsenko-Desktop-figma-text-autofix-plugin/canvases/manual-qa-checklist.canvas.tsx`
- Extracted to: `qa/scenarios.json`, `qa/agent-results.json`
- Tool: `node scripts/qa-extract-canvas-items.mjs`

## Counts (definitions)

| Metric | Value |
| --- | ---: |
| Scenarios (ITEMS) | 54 |
| Max stable `n` / `id` | 54 |
| Agent notes migrated | 54 |

## Live Canvas state (done / comments / screenshots)

| Metric | Value |
| --- | --- |
| `done-v6` | **not readable** from agent tools |
| `broken-v1` | **not readable** from agent tools |
| `shots-v1` | **not readable** from agent tools |

`useCanvasState` lives in Cursor IDE runtime. Agent cannot read or write those keys. **History is not declared migrated.**

User path: open the QA canvas → **Export session** → save JSON under `qa/manual-sessions/` (or paste into Import). Until that file exists, manual marks remain only in local Canvas state.

## Legacy task IDs

Known YAML→tracker map: `qa/legacy-id-map.json` (from Sheets A-007 description). Canvas `agentNote` references like `qa-1` kept as `legacyTaskIds` without inventing T-IDs.

## Portable canvas shell

- Repo copy: `qa/canvas/manual-qa-checklist.canvas.tsx` (Export/Import session, «В бэклог» → Sheets A-007).
- Live IDE path is mirrored by `npm run qa:sync-canvas`.
- Scenario `#55` covers the session round-trip; linked to `T-046` / legacy `pipeline-qa`.

## Preservation

- Original live canvas file is **not deleted**.
- Canvas ITEMS regenerate from `qa/scenarios.json` via `npm run qa:sync-canvas`.
- No `useCanvasState` keys were cleared.
