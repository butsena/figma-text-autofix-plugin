# Исключения границы предложения (boundary-exceptions)

Список фраз, после которых плагин **не предлагает** точку на неявной границе предложения: бренды, названия, русские сокращения (ИИ, ЖКХ) и т.п.

## Отдельный репозиторий — намеренно

| Репозиторий | Что внутри | Зачем |
|---|---|---|
| [figma-text-autofix-lexicon](https://github.com/butsena/figma-text-autofix-lexicon) | `text-replacements.csv` — пары замен | Редакционные замены слов |
| [figma-text-autofix-boundary-exceptions](https://github.com/butsena/figma-text-autofix-boundary-exceptions) | `boundary-exceptions.txt` — одна фраза на строку | Когда не нужна точка |
| [figma-text-autofix-ambiguous-form-choices](https://github.com/butsena/figma-text-autofix-ambiguous-form-choices) | `ambiguous-form-choices.txt` — пары форм | Формы сложных слов |

**Не смешиваем** замены и исключения в одном репозитории: разные задачи, разные редакторы, разный формат.

Ветка отдельного репозитория не нужна — достаточно `main` и одного файла в корне.

## Raw URL для плагина

```
https://raw.githubusercontent.com/butsena/figma-text-autofix-boundary-exceptions/main/boundary-exceptions.txt
```

При старте плагин подтягивает файл с GitHub; при ошибке — `data/boundary-exceptions.txt` из бандла.

## Формат файла

```txt
# комментарии через #
Knight Frank
Google Pay
ИИ
```

## Синхронизация remote → bundled fallback (для разработчиков)

После merge PR в репозиторий исключений:

```bash
curl -sL "https://raw.githubusercontent.com/butsena/figma-text-autofix-boundary-exceptions/main/boundary-exceptions.txt" \
  -o data/boundary-exceptions.txt
npm run build
```

Так офлайн-fallback остаётся актуальным.

## Создание репозитория

1. Public repo: `figma-text-autofix-boundary-exceptions`
2. Скопировать `data/boundary-exceptions.txt` из плагина в корень как `boundary-exceptions.txt`
3. Короткий README: что это за список и как добавлять строки

Конфиг URL: `src/config/boundary-exceptions-remote-url.ts`
