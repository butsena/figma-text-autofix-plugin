# QA workflow (T-046, T-139)

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

Canvas **не может** импортировать файлы репозитория. `npm run qa:sync-canvas` обновляет ITEMS и встраивает тот же адаптер `src/qa/qa-session-adapter.ts`, который проверяется тестами, в `qa/canvas/`, затем зеркалит файл в live path. Не править генерируемый блок адаптера вручную. В изолированном checkout используйте `--repo-only`, чтобы не перезаписать live Canvas и чужие локальные изменения.

## Команды

```bash
npm run qa:extract-canvas   # TSX ITEMS → qa/scenarios.json (+ agent-results)
npm run qa:sync-canvas      # qa/*.json + адаптер → Canvas и live path
npm run qa:sync-canvas -- --repo-only # только repo Canvas, без записи в IDE
npm run test -- src/qa/qa-model.test.ts src/qa/qa-session-adapter.test.mjs
```

`src/qa/qa-session-adapter.test.mjs` содержит проверки адаптера и Node-harness реальных обработчиков Canvas; Vitest обнаруживает также `src/**/*.test.mjs`. Node API теста не попадают в TypeScript-проверку плагина. Сам адаптер остаётся в `qa-session-adapter.ts` и проверяется отдельно как TypeScript.

## Ручная сессия

Канонические записи `QaManualEntry` живут в `useCanvasState("manual-entries-v1")`: статус, комментарий, вложения, дата, commit и история. Старые ключи `done-v6`, `broken-v1`, `shots-v1` читаются только для миграции записей, которых ещё нет в каноническом состоянии. `done=true` без бага становится `processed_legacy`, **не** `passed`; существующая запись, включая `not_run`, всегда имеет приоритет над legacy.

1. Открой QA-канвас. Выбирай один из пяти ручных статусов: `not_run`, `passed`, `failed`, `needs_retest`, `processed_legacy`. `passed` ставит только человек после проверки в Figma. Комментарий и скриншот не определяют статус автоматически.
2. При необходимости укажи SHA проверяемой сборки. Поле применяется при следующем выборе статуса; без него прежний `checkedCommit` сохраняется. Изменение статуса сохраняет прежнюю запись в `history` и ставит дату действия. Комментарии и вложения сохраняются.
3. **Export session** — скопируй JSON. Экспорт сохраняет все записи и их поля; меняет служебные `exportedAt`, `canvasPath`, `unsavedSession`.
4. Сохрани как `qa/manual-sessions/YYYY-MM-DD.json` (агент или человек). Только после записи файла пометь сохранённый JSON `unsavedSession: false`. Экспорт из живого Canvas всегда `true`: Canvas не проверяет факт записи на диск.
5. На другом окружении: **Import session** — вставь JSON. Каждая переданная запись заменяется целиком, поэтому `not_run` сбрасывает предыдущий результат; отсутствующие ID остаются. Сначала проверяется весь импорт: ошибка не меняет ни одной записи. Определения сценариев и агентские результаты не импортируются.

Вложения сохраняют `id`, `relativePath`, необязательные `mimeType` и `dataUrl`. При наличии `dataUrl` виден предпросмотр. Без него Canvas показывает относительный путь, не удаляя вложение. Для переноса самой картинки без `dataUrl` файл под `qa/attachments/` нужно сохранить и перенести отдельно: один путь не создаёт файл. Новые скриншоты экспортируются со встроенным `dataUrl` и остаются переносимыми вместе с JSON.

Сценарий #55 / T-139 проверяет реальные обработчики Canvas: все статусы, метаданные, историю, оба вида вложений, `not_run` поверх результата и отклонение неверного импорта. Старый JSON-only round-trip не считается проверкой этих обработчиков. Живой Canvas и работа вложений в IDE требуют ручной проверки; агент не ставит её `passed`.

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
