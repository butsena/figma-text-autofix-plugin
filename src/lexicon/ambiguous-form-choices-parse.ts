import {
  MSG_CHOICE_ISHCHITE_ISHCHETE,
  MSG_CHOICE_VSE_VSYO,
} from "../rules/rule-messages";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export type AmbiguousFormChoice = {
  id: string;
  options: [string, string];
  message: string;
  hint?: string;
  hintHtml?: string;
  allowSkip?: boolean;
};

const CHOICE_LINE_RE = /^(.+?) - (.+?) - (.+)$/;

function slugChoiceId(option1: string, option2: string): string {
  const slug = (word: string) =>
    word
      .toLowerCase()
      .replace(/ё/g, "yo")
      .replace(/[^a-zа-я0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  return `cian-choice-${slug(option1)}-${slug(option2)}`;
}

function messageForChoiceId(id: string): string {
  if (id === "cian-choice-vse-vsyo") return MSG_CHOICE_VSE_VSYO;
  return MSG_CHOICE_ISHCHITE_ISHCHETE;
}

function formatChoiceHintHtml(hint: string): { hint?: string; hintHtml?: string } {
  const trimmed = hint.trim();
  if (!trimmed) return {};

  if (trimmed.includes(";") || trimmed.includes("|")) {
    const items = trimmed
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);
    const listItems = items
      .map((item) => {
        const [question, example] = item.split("|").map((part) => part.trim());
        if (example) {
          return `<li>${escapeHtml(question)} <span class="reportHintSep">|</span> ${escapeHtml(example)}</li>`;
        }
        return `<li>${escapeHtml(item)}</li>`;
      })
      .join("\n      ");

    return {
      hintHtml: `
  <div class="reportHint">
    <div class="reportHintTitle">Подсказка:</div>
    <ul class="reportHintList">
      ${listItems}
    </ul>
  </div>`,
    };
  }

  return { hint: trimmed };
}

/** Строки `ambiguous-form-choices.txt`: форма1 - форма2 - подсказка. */
export function parseAmbiguousFormChoices(raw: string): AmbiguousFormChoice[] {
  const out: AmbiguousFormChoice[] = [];
  let pendingId: string | undefined;

  for (const line of raw.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const idMatch = trimmed.match(/^#\s*id:\s*(\S+)\s*$/i);
    if (idMatch) {
      pendingId = idMatch[1];
      continue;
    }

    if (trimmed.startsWith("#")) continue;

    const match = trimmed.match(CHOICE_LINE_RE);
    if (!match) {
      throw new Error(`Неверная строка ambiguous-form-choices: ${trimmed}`);
    }

    const [, option1, option2, hint] = match;
    const id = pendingId ?? slugChoiceId(option1, option2);
    pendingId = undefined;

    const hintFields = formatChoiceHintHtml(hint);
    out.push({
      id,
      options: [option1, option2],
      message: messageForChoiceId(id),
      allowSkip: false,
      ...hintFields,
    });
  }

  return out;
}
