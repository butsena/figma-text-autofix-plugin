# Орфографический словарь (spell-dictionary)

Hunspell-словарь русского языка и дополнительные списки для проверки орфографии в плагине.

## Отдельный репозиторий — намеренно

| Репозиторий | Что внутри | Зачем |
|---|---|---|
| [text-autofix-replacements](https://github.com/butsena/text-autofix-replacements) | `text-replacements.csv` | Редакционные замены |
| [text-autofix-no-period](https://github.com/butsena/text-autofix-no-period) | `boundary-exceptions.txt` | Исключения для правила про точку |
| [text-autofix-spelling](https://github.com/butsena/text-autofix-spelling) | Hunspell `ru_RU.aff` / `ru_RU.dic` + доп. списки | Полная орфография |

**Не смешиваем** с lexicon: другой формат, другой объём (~3 MB), другие редакторы.

Ветка отдельного репозитория не нужна — достаточно `main`.

## Файлы в репозитории

| Файл | Описание |
|---|---|
| `ru_RU.aff` | Affix-правила Hunspell (LibreOffice / Freedesktop) |
| `ru_RU.dic` | Базовые леммы (~146 000 записей + affix → ~1,3 млн форм) |
| `spell-supplement.txt` | Доменные слова, которых нет в ru_RU |
| `spell-whitelist.txt` | Бренды и аббревиатуры — не помечать как ошибку |

## Raw URL для плагина

```
https://raw.githubusercontent.com/butsena/text-autofix-spelling/main/ru_RU.aff
https://raw.githubusercontent.com/butsena/text-autofix-spelling/main/ru_RU.dic
https://raw.githubusercontent.com/butsena/text-autofix-spelling/main/spell-supplement.txt
https://raw.githubusercontent.com/butsena/text-autofix-spelling/main/spell-whitelist.txt
```

При старте плагин подтягивает все четыре файла с GitHub.  
Большой словарь **не хранится в бандле плагина** — только remote. Без сети орфография отключается.

Конфиг URL: `src/config/spell-dictionary-remote-url.ts`

## Подготовка файлов для публикации (разработчики)

```bash
npm run sync:spell-dictionary
```

Скрипт копирует файлы из `node_modules/dictionary-ru` (LibreOffice ru_RU) в `data/hunspell/` — удобно перед пушем в `text-autofix-spelling`.
## Создание репозитория

1. Public repo: `text-autofix-spelling`
2. Скопировать содержимое `data/hunspell/` из плагина
3. README: лицензия BSD-3-Clause (LibreOffice dictionaries), как добавлять слова в supplement/whitelist
