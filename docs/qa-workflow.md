# QA workflow (T-046)

Google Таблица — единственный бэклог задач. QA хранится отдельно в репозитории плагина (`qa/`), не как копия очереди.

## Файлы

| Path | Role |
| --- | --- |
| `qa/scenarios.json` | Определения сценариев (id/n, шаги, expected, area, links) |
| `qa/agent-results.json` | Результаты агента (`ok` / `ok-code` / `fixed` / `partial`) |
| `qa/manual-sessions/*.json` | Журнал ручных проверок (экспорт из Canvas) |
| `qa/attachments/` | Переносимые скриншоты (относительные пути) |
| `qa/canvas/manual-qa-checklist.canvas.tsx` | Переносимый shell канваса (Export/Import, «В бэклог») |
| `qa/legacy-id-map.json` | Известные YAML → T-ID |
| `qa/inventory-*.md` | Отчёты инвентаризации |
| `qa/manual-session.schema.json` | Схема ручной сессии |

Live Canvas UI (IDE):  
`/Users/a.butsenko/.cursor/projects/Users-a-butsenko-Desktop-figma-text-autofix-plugin/canvases/manual-qa-checklist.canvas.tsx`  

Canvas **не может** импортировать файлы репозитория. `npm run qa:sync-canvas` обновляет ITEMS в `qa/canvas/` и зеркалит файл в live path.

## Команды

```bash
npm run qa:extract-canvas   # TSX ITEMS → qa/scenarios.json (+ agent-results)
npm run qa:sync-canvas      # qa/*.json → ITEMS в canvas TSX
npm run test -- src/qa/qa-model.test.ts
```

## Ручная сессия (done / комментарии / скриншоты)

Состояние `useCanvasState` (`done-v6`, `broken-v1`, `shots-v1`) живёт только в IDE.

1. Открой QA-канвас.
2. **Export session** — скопируй JSON.
3. Сохрани как `qa/manual-sessions/YYYY-MM-DD.json` (агент или человек).
4. На другом окружении: **Import session** — вставь JSON.

Пока файл в `qa/manual-sessions/` не сохранён, экспорт помечен `unsavedSession: true`.  
`done=true` из старого канваса при импорте → статус `processed_legacy`, **не** `passed`.

## Обновление после правки поведения

Правило: `.cursor/rules/qa-checklist-on-logic-change.mdc`.

1. Обновить/добавить сценарий в `qa/scenarios.json` (новый `n` = max+1).
2. `npm run qa:sync-canvas`.
3. При необходимости — тест в `src/test/manual-qa-checklist-verify.test.ts`.
4. Затронутые ручные результаты → `needs_retest` (история сохраняется).
5. Агент **не** ставит ручной `passed`.

## «В бэклог»

Кнопка создаёт чат с промптом на запись в Google Sheets, область **A-007**, через Sheets MCP.  
Не обновлять `backlog.yaml` и старый improvements-backlog canvas.  
Не чистить комментарии/скриншоты после передачи. Дедуп по QA id + исходная задача/PR + суть дефекта.

## Production bundle

Каталог `qa/` не включается в `dist/main.js` (vite entry — plugin main). Не импортировать `qa/*` из runtime плагина.
