# Орфографическая проверка (Hunspell)

Плагин проверяет кириллические слова через **Hunspell** (`nspell` в рантайме).

## Отдельный public-репозиторий

Все файлы орфографии — в [text-autofix-spelling](https://github.com/butsena/text-autofix-spelling):

| Файл | Назначение |
|---|---|
| `ru_RU.aff` / `ru_RU.dic` | Базовый Hunspell (LibreOffice, ~146k лемм) |
| `spell-supplement.txt` | Доменные слова |
| `spell-whitelist.txt` | Бренды и аббревиатуры |

Подробнее: [spell-dictionary-github.md](./spell-dictionary-github.md)

При старте плагин подтягивает все четыре файла с GitHub.  
Большой `ru_RU` **не вшит в бандл**: без сети орфопроверка просто отключается (остальные правила работают).

## Почему LibreOffice ru_RU, а не AOT (~380k)

AOT permissive (8 MB плоского `.dic`) не инициализируется в `nspell` за разумное время (>10 мин). LibreOffice ru_RU — самый полный *практичный* открытый Hunspell: affix-правила покрывают падежи, числа, род (~1,3 млн форм).

## Подготовка файлов для GitHub (разработчики)

```bash
npm run sync:spell-dictionary   # data/hunspell/ru_RU.* из dictionary-ru → публикация в text-autofix-spelling
```

## Поведение

- Правило `orthography-spellcheck`, политика **confirm**.
- Hunspell инициализируется один раз после загрузки словаря с GitHub (~1–2 с).
- Без GitHub: в «Технической хрени» будет «нужен GitHub», орфография не предлагается.