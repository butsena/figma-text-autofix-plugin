# Правила выбора формы (form-choices)

Пары равноправных написаний, где плагин **не исправляет**, а просит выбрать вариант («ищите / ищете», «все / всё»).

## Отдельный репозиторий — намеренно

| Репозиторий | Что внутри | Зачем |
|---|---|---|
| [figma-text-autofix-lexicon](https://github.com/butsena/figma-text-autofix-lexicon) | `text-replacements.csv` | Однозначные замены |
| [figma-text-autofix-form-choices](https://github.com/butsena/figma-text-autofix-form-choices) | `ambiguous-form-choices.txt` | Choice-правила |

**Не смешиваем** с lexicon: другая политика (`choice`, не `confirm`/`auto`) и другой формат.

## Raw URL для плагина

```
https://raw.githubusercontent.com/butsena/figma-text-autofix-form-choices/main/ambiguous-form-choices.txt
```

При старте плагин подтягивает файл с GitHub; при ошибке — `data/ambiguous-form-choices.txt` из бандла.

## Формат файла

```txt
# id: cian-choice-ishchite-ishchete
ищите - ищете - что делаете? | ищете квартиру; что делайте? | ищите квартиру на Циане
# id: cian-choice-vse-vsyo
все - всё - по редполитике Циана мы пишем ё там, где это требуется
```

Парсер: `src/rules/choice/ambiguous-form-choices-parse.ts`

## Синхронизация remote → bundled fallback

После merge PR в form-choices-репо:

```bash
curl -sL "https://raw.githubusercontent.com/butsena/figma-text-autofix-form-choices/main/ambiguous-form-choices.txt" \
  -o data/ambiguous-form-choices.txt
npm run build
```

## Создание репозитория

1. Public repo: `figma-text-autofix-form-choices`
2. Скопировать `data/ambiguous-form-choices.txt` в корень
3. Короткий README с форматом строк

Конфиг URL: `src/config/form-choices-remote-url.ts`
