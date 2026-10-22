# Кураторские списки (ты/вы, обязательное ё)

Редакционные списки в public-репозитории  
https://github.com/butsena/text-autofix-curated

**Инструкция для редакторов — в README репозитория** (формат строк, как править на GitHub, что не класть в списки):

https://github.com/butsena/text-autofix-curated/blob/main/README.md

| Файл | UI-строка в плагине |
|---|---|
| `ty-vy-curated.txt` | Ты/вы |
| `yo-curated.txt` | Обязательное ё |

Омонимы е/ё с выбором формы (все/всё и т.п.) — в [text-autofix-word-forms](https://github.com/butsena/text-autofix-word-forms).

## Raw URL

```
https://raw.githubusercontent.com/butsena/text-autofix-curated/main/ty-vy-curated.txt
https://raw.githubusercontent.com/butsena/text-autofix-curated/main/yo-curated.txt
```

Конфиг плагина: `LEXICON_REMOTE.tyVyCurated` / `yoCurated` в `src/config/lexicon-remote-config.ts`.

## Синхронизация remote → bundled (перед релизом)

```bash
npm run sync:curated-lists
npm run build
```
