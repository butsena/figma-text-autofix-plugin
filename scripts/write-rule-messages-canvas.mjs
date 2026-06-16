import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("/tmp/rule-data.json", "utf8"));

const canvas = `import {
  H1,
  H2,
  Text,
  Stack,
  Row,
  Stat,
  Table,
  TextInput,
  Select,
  Divider,
  useCanvasState,
} from "cursor/canvas";

const RULES = ${JSON.stringify(data)} as const;

const CATEGORIES = [
  { value: "all", label: "Все категории" },
  ...Array.from(new Set(RULES.map((r) => r.cat)))
    .sort()
    .map((cat) => ({
      value: cat,
      label: RULES.find((r) => r.cat === cat)?.catLabel ?? cat,
    })),
];

export default function RuleMessagesReport() {
  const [query, setQuery] = useCanvasState("query", "");
  const [category, setCategory] = useCanvasState("category", "all");

  const q = query.trim().toLowerCase();
  const filtered = RULES.filter((r) => {
    if (category !== "all" && r.cat !== category) return false;
    if (!q) return true;
    return (
      r.id.toLowerCase().includes(q) ||
      r.catLabel.toLowerCase().includes(q) ||
      r.message.toLowerCase().includes(q)
    );
  });

  const byCat = new Map<string, number>();
  for (const r of RULES) {
    byCat.set(r.catLabel, (byCat.get(r.catLabel) ?? 0) + 1);
  }

  return (
    <Stack gap={16} style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <Stack gap={4}>
        <H1>Комментарии правок в отчёте</H1>
        <Text tone="secondary" size="small">
          figma-text-autofix-plugin · {RULES.length} уникальных сообщений
        </Text>
      </Stack>

      <Row gap={12} style={{ flexWrap: "wrap" }}>
        <Stat label="Всего сообщений" value={String(RULES.length)} />
        <Stat label="Категорий" value={String(byCat.size)} />
        <Stat
          label="Показано"
          value={String(filtered.length)}
          tone={filtered.length < RULES.length ? "accent" : "default"}
        />
      </Row>

      <Row gap={12} style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 280px", minWidth: 200 }}>
          <Text size="small" tone="secondary" style={{ marginBottom: 4 }}>
            Поиск
          </Text>
          <TextInput
            value={query}
            onChange={setQuery}
            placeholder="ID, категория или текст комментария"
          />
        </div>
        <div style={{ flex: "0 1 220px", minWidth: 180 }}>
          <Text size="small" tone="secondary" style={{ marginBottom: 4 }}>
            Категория
          </Text>
          <Select value={category} onChange={setCategory} options={CATEGORIES} />
        </div>
      </Row>

      <Divider />

      <H2>Таблица комментариев</H2>
      <Text tone="tertiary" size="small">
        Колонка «Комментарий» — текст поля message, который показывается в отчёте плагина.
      </Text>

      <Table
        headers={["Категория", "ID правила", "Комментарий в отчёте"]}
        striped
        stickyHeader
        framed
        style={{ maxHeight: "70vh" }}
        emptyMessage="Ничего не найдено — измените фильтр или поиск."
        rows={filtered.map((r) => [r.catLabel, r.id, r.message])}
      />
    </Stack>
  );
}
`;

const out =
  "/Users/a.butsenko/.cursor/projects/Users-a-butsenko-Desktop/canvases/autofix-rule-messages.canvas.tsx";
fs.writeFileSync(out, canvas);
console.log("written", out, canvas.length);
