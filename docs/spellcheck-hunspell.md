# Орфографическая проверка (Hunspell)

Плагин проверяет кириллические слова через **Hunspell** (`nspell` в рантайме).

## Отдельный public-репозиторий

Все файлы орфографии — в [figma-text-autofix-spell-dictionary](https://github.com/butsena/figma-text-autofix-spell-dictionary):

| Файл | Назначение |
|---|---|
| `ru_RU.aff` / `ru_RU.dic` | Базовый Hunspell (LibreOffice, ~146k лемм) |
| `spell-supplement.txt` | Доменные слова |
| `spell-whitelist.txt` | Бренды и аббревиатуры |

Подробнее: [spell-dictionary-github.md](./spell-dictionary-github.md)

При старте плагин подтягивает все четыре файла с GitHub; при ошибке — bundled fallback из `data/hunspell/` (+ gzip в бандле).

## Почему LibreOffice ru_RU, а не AOT (~380k)

AOT permissive (8 MB плоского `.dic`) не инициализируется в `nspell` за разумное время (>10 мин). LibreOffice ru_RU — самый полный *практичный* открытый Hunspell: affix-правила покрывают падежи, числа, род (~1,3 млн форм).

## Сборка bundled fallback

```bash
npm run sync:spell-dictionary   # data/hunspell/ru_RU.* из dictionary-ru
npm run build:hunspell          # gzip в src/spell/hunspell-dict.generated.ts
```

## Поведение

- Правило `orthography-spellcheck`, политика **confirm**.
- Hunspell инициализируется один раз при запуске (~1–2 с).
