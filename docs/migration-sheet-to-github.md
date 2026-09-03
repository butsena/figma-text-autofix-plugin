# Миграция: Google Таблица → CSV в GitHub

План перехода от двух источников (bundled + Google) к словарю в public-репозитории с подгрузкой по URL.

## Репозитории

| Репозиторий | Назначение |
|---|---|
| [figma-text-autofix-plugin](https://github.com/butsena/figma-text-autofix-plugin) (private) | Код плагина, bundled CSV как fallback |
| [figma-text-autofix-lexicon](https://github.com/butsena/figma-text-autofix-lexicon) (public) | Словарь замен `text-replacements.csv` |
| [figma-text-autofix-boundary-exceptions](https://github.com/butsena/figma-text-autofix-boundary-exceptions) (public) | Когда не нужна точка: `boundary-exceptions.txt` |
| [figma-text-autofix-ambiguous-form-choices](https://github.com/butsena/figma-text-autofix-ambiguous-form-choices) (public) | Формы сложных слов: `ambiguous-form-choices.txt` |
| [figma-text-autofix-spell-dictionary](https://github.com/butsena/figma-text-autofix-spell-dictionary) (public) | Hunspell `ru_RU.aff` / `ru_RU.dic`, `spell-supplement.txt`, `spell-whitelist.txt` |

Raw URL для плагина:  
`https://raw.githubusercontent.com/butsena/figma-text-autofix-lexicon/main/text-replacements.csv`  
`https://raw.githubusercontent.com/butsena/figma-text-autofix-boundary-exceptions/main/boundary-exceptions.txt`  
`https://raw.githubusercontent.com/butsena/figma-text-autofix-ambiguous-form-choices/main/ambiguous-form-choices.txt`  
`https://raw.githubusercontent.com/butsena/figma-text-autofix-spell-dictionary/main/ru_RU.aff`  
`https://raw.githubusercontent.com/butsena/figma-text-autofix-spell-dictionary/main/ru_RU.dic`  
`https://raw.githubusercontent.com/butsena/figma-text-autofix-spell-dictionary/main/spell-supplement.txt`  
`https://raw.githubusercontent.com/butsena/figma-text-autofix-spell-dictionary/main/spell-whitelist.txt`

Подробнее: [boundary-exceptions-github.md](./boundary-exceptions-github.md), [ambiguous-form-choices-github.md](./ambiguous-form-choices-github.md), [spell-dictionary-github.md](./spell-dictionary-github.md).

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

## Синхронизация remote → bundled fallback (для разработчиков)

После merge PR в lexicon-репо (замены):

```bash
curl -sL "https://raw.githubusercontent.com/butsena/figma-text-autofix-lexicon/main/text-replacements.csv" \
  -o data/text-replacements.csv
npm run build
```

После merge PR в репозиторий форм сложных слов:

```bash
curl -sL "https://raw.githubusercontent.com/butsena/figma-text-autofix-ambiguous-form-choices/main/ambiguous-form-choices.txt" \
  -o data/ambiguous-form-choices.txt
npm run build
```

После merge PR в репозиторий исключений:

```bash
curl -sL "https://raw.githubusercontent.com/butsena/figma-text-autofix-boundary-exceptions/main/boundary-exceptions.txt" \
  -o data/boundary-exceptions.txt
npm run build
```

После merge PR в репозиторий орфографии:

```bash
npm run sync:spell-dictionary
```

Так bundled fallback остаётся актуальным для офлайн-запуска.
