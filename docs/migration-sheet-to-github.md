# Миграция: Google Таблица → CSV в GitHub

План перехода от двух источников (bundled + Google) к словарю в public-репозитории с подгрузкой по URL.

## Репозитории

| Репозиторий | Назначение |
|---|---|
| [figma-text-autofix-plugin](https://github.com/butsena/figma-text-autofix-plugin) (private) | Код плагина, bundled CSV как fallback |
| [figma-text-autofix-lexicon](https://github.com/butsena/figma-text-autofix-lexicon) (public) | Словарь `text-replacements.csv` для редакторов |

Raw URL для плагина:  
`https://raw.githubusercontent.com/butsena/figma-text-autofix-lexicon/main/text-replacements.csv`

## Шаги

1. ~~Синхронизировать Google → bundled CSV (один раз).~~ Выполнено.

2. **Переключить плагин на fetch raw CSV с GitHub, fallback bundled.**

3. **Public-репозиторий словаря** — PR редакторов в `figma-text-autofix-lexicon`.

4. **Удалить Google-код** (JSONP, merge, `networkAccess` для Sheets).

5. **CI-валидация CSV.**

## Статус

- [x] Шаг 1 — sync + bundled CSV (181 строк)
- [x] Шаг 2 — fetch GitHub, fallback bundled
- [x] Шаг 3 — public `figma-text-autofix-lexicon`
- [x] Шаг 4 — Google-код удалён
- [ ] Шаг 5

## Синхронизация lexicon → plugin (для разработчиков)

После merge PR в lexicon-репо скопируйте CSV в основной проект:

```bash
curl -sL "https://raw.githubusercontent.com/butsena/figma-text-autofix-lexicon/main/text-replacements.csv" \
  -o data/text-replacements.csv
npm run build
```

Так bundled fallback остаётся актуальным для офлайн-запуска.
