# Формы сложных слов (ambiguous-form-choices)

Пары равноправных форм, где плагин **не выбирает за редактора**, а просит выбрать: **ищите/ищете**, **все/всё** и т.п.

## Отдельный репозиторий — намеренно

| Репозиторий | Что внутри | Зачем |
|---|---|---|
| [figma-text-autofix-lexicon](https://github.com/butsena/figma-text-autofix-lexicon) | `text-replacements.csv` — пары замен | Редакционные замены слов |
| [figma-text-autofix-boundary-exceptions](https://github.com/butsena/figma-text-autofix-boundary-exceptions) | `boundary-exceptions.txt` — одна фраза на строку | Когда не нужна точка |
| [figma-text-autofix-ambiguous-form-choices](https://github.com/butsena/figma-text-autofix-ambiguous-form-choices) | `ambiguous-form-choices.txt` — пары форм | Формы сложных слов |

**Не смешиваем** с заменами и исключениями: другой формат, другая UX-логика (choice, а не auto/confirm).

Ветка отдельного репозитория не нужна — достаточно `main` и одного файла в корне.

## Raw URL для плагина

```
https://raw.githubusercontent.com/butsena/figma-text-autofix-ambiguous-form-choices/main/ambiguous-form-choices.txt
```

При старте плагин подтягивает файл с GitHub; при ошибке — `data/ambiguous-form-choices.txt` из бандла плагина (только fallback).

## Формат файла

```txt
# id: cian-choice-ishchite-ishchete
ищите - ищете - что делаете? | пример; что делайте? | другой пример
# id: cian-choice-vse-vsyo
все - всё - по редполитике Циана мы пишем ё там, где это требуется
```

- Строка: `форма1 - форма2 - подсказка`
- Несколько пунктов подсказки — через `;`, в пункте «вопрос | пример»
- Опционально перед парой: `# id: cian-choice-...` (стабильный id правила)
- Комментарии и пустые строки игнорируются

## Синхронизация remote → bundled fallback (для разработчиков)

После merge PR в репозиторий форм:

```bash
curl -sL "https://raw.githubusercontent.com/butsena/figma-text-autofix-ambiguous-form-choices/main/ambiguous-form-choices.txt" \
  -o data/ambiguous-form-choices.txt
npm run build
```

Так офлайн-fallback в плагине остаётся актуальным.

## Создание репозитория

1. Public repo: `figma-text-autofix-ambiguous-form-choices`
2. Скопировать `data/ambiguous-form-choices.txt` из плагина в корень как `ambiguous-form-choices.txt`
3. Короткий README: что это за список и как добавлять строки

Конфиг URL: `src/config/ambiguous-form-choices-remote-url.ts`
