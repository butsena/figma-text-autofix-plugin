# Миграция: Google Таблица → CSV в GitHub

План перехода от двух источников (bundled + Google) к одному CSV в репозитории с подгрузкой по URL.

## Шаги

1. **Синхронизировать Google → `data/text-replacements.csv` (один раз).**  
   Скрипт: `npm run sync:text-replacements`  
   Логика: строки из Google + строки из bundled, чьих вариантов нет в Google.

2. **Переключить плагин на вариант B:** fetch raw CSV с GitHub, fallback bundled.

3. **Убедиться, что команда ок с GitHub-workflow** (PR на `data/text-replacements.csv`).

4. **Удалить Google-код и второй источник** (JSONP, merge, `networkAccess` для Sheets).

5. **Добавить CI-валидацию CSV.**

## Статус

- [x] Шаг 1 — скрипт синхронизации и обновление bundled CSV (2026-05-19: 67 remote + 114 bundled-only → 181 строк)
- [x] Шаг 2 — fetch raw CSV с GitHub, fallback bundled (без merge)
- [ ] Шаг 3
- [ ] Шаг 4
- [ ] Шаг 5
