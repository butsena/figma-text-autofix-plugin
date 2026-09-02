# Орфографическая проверка (Hunspell)

Плагин проверяет кириллические слова через **Hunspell** (`nspell` в рантайме).

## Базовый словарь

| Источник | Записей | Форм (через affix) | Размер |
|---|---:|---:|---:|
| **LibreOffice / Freedesktop `ru_RU`** (bundled) | ~146 000 лемм | ~1,3 млн | ~3,3 MB → ~600 KB gzip в бандле |
| AOT permissive (GitLab, ~380k строк) | ~380 000 | плоский список | ~8 MB — **не используется**: инициализация `nspell` >10 мин |

Выбран **LibreOffice `ru_RU`** — самый полный *практичный* открытый Hunspell для JS: affix-правила покрывают падежи, числа, род.

Лицензия: BSD-3-Clause ([dictionary-ru](https://www.npmjs.com/package/dictionary-ru) → [LibreOffice/dictionaries](https://github.com/LibreOffice/dictionaries)).

Пересборка встроенного словаря:

```bash
npm run build:hunspell
```

## Дополнения (GitHub)

| Файл | Назначение |
|---|---|
| `data/spell-supplement.txt` | доменные слова, которых нет в ru_RU |
| `data/spell-whitelist.txt` | бренды/аббревиатуры — не помечать как ошибку |

Raw URL (lexicon-репо, fallback — bundled):

- `spell-supplement.txt`
- `spell-whitelist.txt`

## Поведение

- Правило `orthography-spellcheck`, политика **confirm** (не авто).
- Слова короче 2 букв, с цифрами, ALL CAPS ≤5 букв — пропуск.
- Не пересекается с уже найденными правилами (ё, замены и т.д.).
- Hunspell инициализируется один раз при запуске пайплайна (~1–2 с).

## Что не покрывает

- Омонимы и «не то слово, но существующее».
- Латиница без whitelist.
- Пунктуация и типографика — отдельные правила.
