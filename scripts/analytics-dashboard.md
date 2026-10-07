# Dashboard для Text Autofix analytics

Лист `events` пишет Apps Script.

## Быстрый путь (рекомендуется)

1. Откройте ту же таблицу → **Расширения → Apps Script**.
2. Замените код на актуальный `scripts/analytics-apps-script.js` из репозитория (или допишите функцию `setupDashboard` в конец).
3. Сохраните → в списке функций выберите **`setupDashboard`** → **Выполнить**.
4. Вернитесь в таблицу: лист **`dashboard`** с формулами (сводка, 7 дней, 3 месяца, год).

Повторный запуск `setupDashboard()` **очистит** лист `dashboard` и соберёт заново. Лист `events` не трогает.

Ниже — ручная раскладка (если скрипт недоступен). Локаль RU в UI: разделитель `;`; в `setFormula` Apps Script использует `,`.

`server_time` в events — ISO-текст UTC (`2026-10-07T…Z`). Для «по дням» сравнивайте `LEFT(A;10)` с `TEXT(день;"yyyy-mm-dd")`, не `COUNTIFS` по дате листа.

В `payload_json` у `manual_fix_complete`:
- `"action":"applied"` | `"skipped"`
- `"kind":"confirm"` | `"orthography"`

У `choice_resolved`: `"action":"confirmed"` | `"skipped"`.

---

## Лист `dashboard` — сводка

| Ячейка | Подпись (A) | Формула (B) |
|--------|-------------|-------------|
| 2 | Запуски | `=COUNTIF(events!F:F;"plugin_open")` |
| 3 | Сканы | `=COUNTIF(events!F:F;"scan_complete")` |
| 4 | Авто | `=COUNTIF(events!F:F;"auto_fix_complete")` |
| 5 | Ручные | `=COUNTIF(events!F:F;"manual_fix_complete")` |
| 6 | → Исправить | см. ниже |
| 7 | →→ орфография | |
| 8 | →→ confirm | |
| 9 | → Пропустить | |
| 10 | →→ орфография | |
| 11 | →→ confirm | |
| 12 | Выбор | `=COUNTIF(events!F:F;"choice_resolved")` |
| 13 | → Подтвердить | |
| 14 | → Пропустить | |
| 15 | Ошибки | `=COUNTIF(events!F:F;"plugin_error")` |
| 16 | Auto applied (сумма) | см. ниже |
| 17 | Auto not_applied (сумма) | см. ниже |

### Формулы вложенности (ручные)

B6 — все «Исправить»:

```
=SUMPRODUCT((events!F2:F="manual_fix_complete")*(ISNUMBER(SEARCH("""action"":""applied""";events!G2:G))))
```

B7 — Исправить → орфография:

```
=SUMPRODUCT((events!F2:F="manual_fix_complete")*(ISNUMBER(SEARCH("""action"":""applied""";events!G2:G)))*(ISNUMBER(SEARCH("""kind"":""orthography""";events!G2:G))))
```

B8 — Исправить → confirm:

```
=SUMPRODUCT((events!F2:F="manual_fix_complete")*(ISNUMBER(SEARCH("""action"":""applied""";events!G2:G)))*(ISNUMBER(SEARCH("""kind"":""confirm""";events!G2:G))))
```

B9 — все «Пропустить»:

```
=SUMPRODUCT((events!F2:F="manual_fix_complete")*(ISNUMBER(SEARCH("""action"":""skipped""";events!G2:G))))
```

B10 — Пропустить → орфография:

```
=SUMPRODUCT((events!F2:F="manual_fix_complete")*(ISNUMBER(SEARCH("""action"":""skipped""";events!G2:G)))*(ISNUMBER(SEARCH("""kind"":""orthography""";events!G2:G))))
```

B11 — Пропустить → confirm:

```
=SUMPRODUCT((events!F2:F="manual_fix_complete")*(ISNUMBER(SEARCH("""action"":""skipped""";events!G2:G)))*(ISNUMBER(SEARCH("""kind"":""confirm""";events!G2:G))))
```

Проверки: `B7+B8=B6`, `B10+B11=B9`, `B6+B9=B5`.

### Выбор

B13 — Подтвердить:

```
=SUMPRODUCT((events!F2:F="choice_resolved")*(ISNUMBER(SEARCH("""action"":""confirmed""";events!G2:G))))
```

B14 — Пропустить (choice):

```
=SUMPRODUCT((events!F2:F="choice_resolved")*(ISNUMBER(SEARCH("""action"":""skipped""";events!G2:G))))
```

Проверка: `B13+B14=B12`.

### Суммы auto из payload

B16:

```
=SUM(ARRAYFORMULA(IF(events!F2:F="auto_fix_complete";IFERROR(VALUE(REGEXEXTRACT(events!G2:G;"""applied"":(\d+)"));0);0)))
```

B17:

```
=SUM(ARRAYFORMULA(IF(events!F2:F="auto_fix_complete";IFERROR(VALUE(REGEXEXTRACT(events!G2:G;"""not_applied"":(\d+)"));0);0)))
```

---

## Блок «По дням» (с строки 20)

Заголовки в A20:H20:

`День` | `Запуски` | `Сканы` | `Авто` | `Ручн. испр.` | `Ручн. skip` | `Choice OK` | `Ошибки`

A21 — дата: `=TODAY()` (или вручную).

B21 — запуски:

```
=SUMPRODUCT((events!F2:F="plugin_open")*(LEFT(events!A2:A;10)=TEXT(A21;"yyyy-mm-dd")))
```

C21 — сканы: то же с `"scan_complete"`.

D21 — авто: `"auto_fix_complete"`.

E21 — ручные Исправить:

```
=SUMPRODUCT((events!F2:F="manual_fix_complete")*(LEFT(events!A2:A;10)=TEXT(A21;"yyyy-mm-dd"))*(ISNUMBER(SEARCH("""action"":""applied""";events!G2:G))))
```

F21 — ручные Пропустить: `"skipped"` вместо `"applied"`.

G21 — choice confirmed:

```
=SUMPRODUCT((events!F2:F="choice_resolved")*(LEFT(events!A2:A;10)=TEXT(A21;"yyyy-mm-dd"))*(ISNUMBER(SEARCH("""action"":""confirmed""";events!G2:G))))
```

H21 — ошибки: `"plugin_error"` + день, без action.

Протянуть строку 21 вниз вместе с датами в A.

---

## Блок «По месяцам» (с строки 30)

Заголовки A30:H30:

`Месяц` | `Запуски` | `Авто-проходы` | `Auto applied` | `Ручн. испр.` | `Ручн. skip` | `Choice OK` | `Ошибки`

A31 — ключ месяца (не пользователи):

```
=TEXT(TODAY();"yyyy-mm")
```

Или вручную текст `2026-10`.

B31 — запуски:

```
=SUMPRODUCT((events!F2:F="plugin_open")*(LEFT(events!A2:A;7)=A31))
```

C31 — авто-проходы: `"auto_fix_complete"`.

D31 — сумма auto applied за месяц:

```
=SUMPRODUCT((events!F2:F="auto_fix_complete")*(LEFT(events!A2:A;7)=A31)*(IFERROR(VALUE(REGEXEXTRACT(events!G2:G;"""applied"":(\d+)"));0)))
```

E31 / F31 — ручные applied / skipped + месяц (`LEFT=A31`).

G31 — choice confirmed + месяц.

H31 — plugin_error + месяц.

Протянуть строку вниз; в A32: `=TEXT(EDATE(TODAY();-1);"yyyy-mm")` и т.д.

---

## Блок «По годам» (с строки 40)

То же, но ключ года в A41:

```
=TEXT(TODAY();"yyyy")
```

И в формулах `LEFT(events!A2:A;4)=A41` вместо `;7)=A31`.

---

## Смысл полей

| Подпись | Смысл |
|---------|--------|
| Запуски | Открыли плагин (`plugin_open`). Не уникальные люди. |
| Сканы | Обновили отчёт в UI (`scan_complete`); за один запуск может быть несколько |
| Авто / Авто-проходы | Число событий `auto_fix_complete` |
| Ручные | Confirm / орфография: Исправить или Пропустить |
| → Исправить / → Пропустить | `action` в payload |
| →→ орфография | Поле «Напишите, как исправить» |
| →→ confirm | «Обратите внимание» без spell-input |
| Выбор | Карточка choice |
| → Подтвердить / → Пропустить | `confirmed` / `skipped` |
| Ошибки | `plugin_error` без текста исключения |
| Auto applied / not_applied | Сумма правок из payload auto |
| Месяц / год | Агрегат запусков и правок; пользователей нет |

Сессии ≠ люди: постоянного user id нет.

Канвас с таблицей «что куда»:  
`~/.cursor/projects/.../canvases/analytics-dashboard-setup.canvas.tsx`
