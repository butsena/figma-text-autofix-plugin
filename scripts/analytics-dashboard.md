# Dashboard для Text Autofix analytics

Лист `events` пишет Apps Script.

## T-135: источники орфографических исправлений

Статус на 28.10.2026: по разрешению пользователя рабочий приёмник обновлён до version 4 / T-135-1, разбивка перенесена в рабочий отчёт. Живые проверки приёма и 41 периода прошли; ручная проверка новой сборки в Figma ещё впереди. Полная инструкция — [t135-spelling-source.md](../docs/t135-spelling-source.md), факты внедрения — [t135-rollout-2026-10-28.md](../docs/t135-rollout-2026-10-28.md).

Новая вкладка «Источники орфографии» дополняет отчёт: успешные орфографические замены делятся на «По подсказке», «Свой вариант» и «Источник неизвестен». Сумма групп равна общему числу в каждом из 41 периода. История без нового поля остаётся неизвестной. Общую оценку часов/рублей, коэффициенты и прежние графики эта разбивка не меняет.

Важно: для существующего оформленного отчёта не запускать `setupDashboard()` из следующего раздела — он предназначен для первоначального создания и очищает вкладку `dashboard`.

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

С 23.10.2026 (T-141) новые события различают три разных факта. Формулы, коэффициенты и уже лежащие строки не меняются.

| Факт | Что пишется | Чего нет |
| --- | --- | --- |
| Намерение нажать «Исправить» | само по себе ничего | нет `applied`, пока текст не изменился |
| Текст изменился (confirm или орфография) | `manual_fix_complete` + `applied` | нет второго события на ту же правку |
| Сохранено решение о форме, даже если выбрана исходная и текст тот же | `choice_resolved` + `confirmed` | это не `manual_fix_complete` и не ошибка |

Пустой результат, устаревший фрагмент, отсутствующий слой, замена без изменения и исключение `applied`/`confirmed` не добавляют. Повтор того же уже сохранённого решения не добавляет ещё одну строку. Пропуск остаётся `skipped`.

Граница истории: Community v22 (`plugin_version` `0.22.0`) и более ранние строки считали нажатие. Их нельзя пересчитать как доказанные изменения. Новая семантика только у событий сборки с этой логикой; номер версии в листе меняется вместе со следующей публикацией Community, а не этим коммитом.

С 27.10.2026 (T-142) добор auto после ручного действия может добавить ещё одно `auto_fix_complete`. Формулы, коэффициенты и уже лежащие строки не меняются.

| Что произошло | Что пишется в новое событие | Чего нет |
| --- | --- | --- |
| Ручная правка открыла новые auto, и они применились | `applied` и `categories` только этих новых применений; `found = applied + not_applied` | нет прежнего накопленного отчёта и нет самой ручной правки |
| Новых применений нет | событие не пишется | нет повторной отправки старых `applied` и категорий |
| Часть новых auto не применилась | `applied` — сколько применилось, `not_applied` — сколько ещё найдено после проходов | неприменённое не входит в `applied` и категории |
| Повтор того же действия или ошибка до нового применения | новые применения не дублируются | ошибка не превращает старый отчёт в успех |

`duration_ms` такого события — справочная длительность только этого добора. Формулы часов и рублей её не читают: не прибавлять и не вычитать её из модельной оценки. Старые строки из-за этого не пересчитываются.

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
| 18 | Проверить орфографию | `=COUNTIF(events!F:F;"spellcheck_requested")` |

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
| Проверить орфографию | Клик по кнопке (`spellcheck_requested`), payload `{}`. Один клик — одна строка |
| Auto applied / not_applied | Сумма правок из payload auto |
| Месяц / год | Агрегат запусков и правок; пользователей нет |

Сессии ≠ люди: постоянного user id нет.

Канвас с таблицей «что куда»:  
`~/.cursor/projects/.../canvases/analytics-dashboard-setup.canvas.tsx`
