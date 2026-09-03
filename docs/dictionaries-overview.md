# Словари Text Autofix на GitHub

Плагин при запуске скачивает словари с GitHub. Если сеть недоступна — берёт встроенные копии из папки `data/`.

## Карта репозиториев

| Как называется | Ссылка | Файл | Зачем |
|---|---|---|---|
| **Словарь замен** | https://github.com/butsena/text-autofix-replacements | `text-replacements.csv` | «приобрести → купить» и другие замены |
| **Когда не нужна точка** | https://github.com/butsena/text-autofix-no-period | `boundary-exceptions.txt` | Фразы, где не ставить точку между словами |
| **Формы сложных слов** | https://github.com/butsena/text-autofix-word-forms | `ambiguous-form-choices.txt` | Выбор: ищите/ищете, все/всё |
| **Орфография** | https://github.com/butsena/text-autofix-spelling | `ru_RU.aff`, `ru_RU.dic`, `spell-supplement.txt`, `spell-whitelist.txt` | Проверка опечаток + доп. слова + исключения |

Код плагина (private): https://github.com/butsena/figma-text-autofix-plugin

## Что править редакторам

1. Откройте нужный **public**-репозиторий по ссылке выше.
2. Измените файл на ветке `main`.
3. При следующем запуске плагин подтянет обновление сам (пересборка не нужна).

## Старые имена

GitHub сохраняет редиректы со старых URL. Новые имена:

| Было | Стало |
|---|---|
| `figma-text-autofix-lexicon` | `text-autofix-replacements` |
| `figma-text-autofix-boundary-exceptions` | `text-autofix-no-period` |
| `figma-text-autofix-ambiguous-form-choices` | `text-autofix-word-forms` |
| `figma-text-autofix-spell-dictionary` | `text-autofix-spelling` |
