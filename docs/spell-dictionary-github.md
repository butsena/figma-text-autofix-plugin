# Орфографический словарь (spell-dictionary)

Hunspell-словарь русского языка и дополнительные списки для проверки орфографии в плагине.

## Отдельный репозиторий — намеренно

| Репозиторий | Что внутри | Зачем |
|---|---|---|
| [figma-text-autofix-lexicon](https://github.com/butsena/figma-text-autofix-lexicon) | `text-replacements.csv` | Редакционные замены |
| [figma-text-autofix-boundary-exceptions](https://github.com/butsena/figma-text-autofix-boundary-exceptions) | `boundary-exceptions.txt` | Исключения для правила про точку |
| [figma-text-autofix-spell-dictionary](https://github.com/butsena/figma-text-autofix-spell-dictionary) | Hunspell `ru_RU.aff` / `ru_RU.dic` + доп. списки | Полная орфография |

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
https://raw.githubusercontent.com/butsena/figma-text-autofix-spell-dictionary/main/ru_RU.aff
https://raw.githubusercontent.com/butsena/figma-text-autofix-spell-dictionary/main/ru_RU.dic
https://raw.githubusercontent.com/butsena/figma-text-autofix-spell-dictionary/main/spell-supplement.txt
https://raw.githubusercontent.com/butsena/figma-text-autofix-spell-dictionary/main/spell-whitelist.txt
```

При старте плагин подтягивает все четыре файла с GitHub; при ошибке — bundled-копии из `data/hunspell/`.

Конфиг URL: `src/config/spell-dictionary-remote-url.ts`

## Синхронизация remote → bundled fallback (для разработчиков)

После merge PR в spell-dictionary-репо:

```bash
npm run sync:spell-dictionary
npm run build
```

Скрипт копирует файлы из `node_modules/dictionary-ru` (LibreOffice ru_RU) и актуальные `.txt` в `data/hunspell/`.

## Создание репозитория

1. Public repo: `figma-text-autofix-spell-dictionary`
2. Скопировать содержимое `data/hunspell/` из плагина
3. README: лицензия BSD-3-Clause (LibreOffice dictionaries), как добавлять слова в supplement/whitelist
