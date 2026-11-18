# QA workflow

Google Таблица (A-007) — единственный бэклог задач.  
С **18.11.2026** ручной QA-чеклист в Canvas снят: приёмка по задаче разработки пишется **прямо в задачу**.

## Текущий процесс

1. После смены поведения плагина — QA-шаги и ожидания в задачу (Sheets MCP / комментарий).
2. При необходимости — автопроверка без Figma в `src/test/manual-qa-checklist-verify.test.ts`.
3. Агент не ставит ручную приёмку (`passed`) за человека.

Правила: `.cursor/rules/qa-in-task.mdc`, `.cursor/rules/qa-checklist-on-logic-change.mdc`.

## Архив (не обновлять)

| Path | Role |
| --- | --- |
| `qa/scenarios.json` | Исторические определения сценариев |
| `qa/agent-results.json` | Исторические agent-отметки |
| `qa/manual-sessions/*.json` | Экспорты ручных сессий из бывшего Canvas |
| `qa/attachments/` | Вложения старых сессий |
| `qa/legacy-id-map.json` | YAML → T-ID |
| `qa/inventory-*.md` | Инвентаризация |
| `src/qa/qa-session-adapter.ts` | Парсер старых session JSON |

Удалены: live/repo `manual-qa-checklist` canvas, `t139-export-import*` canvases, `npm run qa:sync-canvas` / `qa:extract-canvas`.

## Production bundle

Каталог `qa/` не включается в `dist/main.js`. Не импортировать `qa/*` из runtime плагина.
