import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AutoApplyReportDto } from "../shared/messages";
import { state } from "./ui-state";

vi.mock("./ui-resize", () => ({
  schedulePluginResize: vi.fn(),
}));

class DetailsElement {
  open = false;
  isConnected = true;
  innerHTML = "";
  parentElement: { outerHTML: string } | null = null;
  classList: { contains: (name: string) => boolean };

  constructor(className = "") {
    const names = className.split(/\s+/).filter(Boolean);
    this.classList = { contains: (name: string) => names.includes(name) };
  }
}

class Element {
  parentElement: unknown = null;
  closest(_selector: string): unknown {
    return null;
  }
}

class SummaryElement extends Element {
  constructor(details: DetailsElement) {
    super();
    this.parentElement = details;
  }

  override closest(selector: string): unknown {
    return selector === "summary" ? this : null;
  }
}

type Listener = (event: {
  target: unknown;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}) => void;

const listeners: { type: string; fn: Listener }[] = [];
const app = {
  addEventListener(type: string, fn: Listener) {
    listeners.push({ type, fn });
  },
};

function detailsFromHtml(html: string): DetailsElement | null {
  const match = html.match(/<details class="([^"]*)"([^>]*)>([\s\S]*)<\/details>/);
  if (!match) return null;
  const details = new DetailsElement(match[1]);
  details.innerHTML = match[3] ?? "";
  details.open = match[2].includes("open");
  return details;
}

vi.stubGlobal("HTMLDetailsElement", DetailsElement);
vi.stubGlobal("HTMLElement", class HTMLElement {});
vi.stubGlobal("HTMLButtonElement", class HTMLButtonElement {});
vi.stubGlobal("HTMLInputElement", class HTMLInputElement {});
vi.stubGlobal("Element", Element);
vi.stubGlobal("Node", class Node {});
vi.stubGlobal("document", {
  getElementById: (id: string) => (id === "app" ? app : null),
  querySelector: () => null,
  createElement: () => ({
    innerHTML: "",
    querySelector(selector: string) {
      if (selector !== "details") return null;
      return detailsFromHtml(this.innerHTML);
    },
  }),
});

const { rerenderAccordion } = await import("./ui-render");
const { initUiEvents } = await import("./ui-events");

const manualReport: AutoApplyReportDto = {
  summary: { checkedLayers: 1, appliedFixCount: 1, changedLayerCount: 1 },
  layers: [
    {
      nodeId: "1:1",
      nodeName: "Слой",
      characterCount: 10,
      fixes: [
        {
          fixId: "f1",
          ruleId: "orthography-spellcheck",
          category: "orthography",
          message: "msg",
          before: "перд",
          after: "перед",
          from: 0,
          to: 4,
          sourceText: "перд тест",
        },
      ],
    },
  ],
};

const autoReport: AutoApplyReportDto = {
  summary: { checkedLayers: 1, appliedFixCount: 1, changedLayerCount: 1 },
  layers: [
    {
      nodeId: "1:2",
      nodeName: "Авто",
      characterCount: 8,
      fixes: [
        {
          fixId: "f2",
          ruleId: "cian-001-cian-brand-uppercase",
          category: "cian_branding",
          message: "msg",
          before: "ЦИАН",
          after: "Циан",
          from: 0,
          to: 4,
          sourceText: "ЦИАН",
        },
      ],
    },
  ],
};

function section(className: string): DetailsElement {
  const details = new DetailsElement(className);
  details.parentElement = { outerHTML: "" };
  return details;
}

function summaryEvent(details: DetailsElement) {
  return {
    target: new SummaryElement(details),
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
}

function fire(
  type: string,
  event: { target: unknown; preventDefault?: () => void; stopPropagation?: () => void },
) {
  for (const listener of listeners) {
    if (listener.type === type) listener.fn(event);
  }
}

async function settle() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("аккордеоны отчётов", () => {
  beforeEach(() => {
    listeners.length = 0;
    state.summary = { checkedLayers: 1, foundFixes: 0, confirmFixes: 0, choiceFixes: 0 };
    state.spellcheckInProgress = false;
    state.lastManualReport = manualReport;
    state.lastReport = autoReport;
    state.ui.manualReportDetailsOpen = false;
    state.ui.reportDetailsOpen = false;
    initUiEvents();
  });

  it("открытие и закрытие меняют тот же details, а не весь блок", () => {
    const details = section("manualReportDetails");
    const block = details.parentElement!;

    rerenderAccordion(details as unknown as HTMLDetailsElement, true);
    expect(block.outerHTML).toBe("");
    expect(details.open).toBe(true);
    expect(details.innerHTML).toContain("перд");
    expect(state.ui.manualReportDetailsOpen).toBe(true);

    rerenderAccordion(details as unknown as HTMLDetailsElement, false);
    expect(block.outerHTML).toBe("");
    expect(details.open).toBe(false);
    expect(details.innerHTML).not.toContain("перд");
    expect(details.innerHTML).toContain("Вы исправили");
    expect(state.ui.manualReportDetailsOpen).toBe(false);
  });

  it("«Исправлено автоматически» тоже остаётся тем же details", () => {
    const details = section("reportDetails");
    rerenderAccordion(details as unknown as HTMLDetailsElement, true);
    expect(details.open).toBe(true);
    expect(details.innerHTML).toContain("ЦИАН");
    expect(details.parentElement!.outerHTML).toBe("");
    expect(state.ui.reportDetailsOpen).toBe(true);

    rerenderAccordion(details as unknown as HTMLDetailsElement, false);
    expect(details.open).toBe(false);
    expect(details.innerHTML).not.toContain("ЦИАН");
    expect(state.ui.reportDetailsOpen).toBe(false);
  });

  it("отсоединённый details по-прежнему заменяется целиком", () => {
    const details = section("manualReportDetails");
    details.isConnected = false;
    rerenderAccordion(details as unknown as HTMLDetailsElement, true);
    expect(details.parentElement!.outerHTML).toContain("manualReportDetails");
    expect(details.parentElement!.outerHTML).toContain("перд");
    expect(details.innerHTML).toBe("");
  });

  it("клик по заголовку открывает и закрывает, даже если DOM уже переключён", async () => {
    const details = section("manualReportDetails");
    details.open = true;

    const openClick = summaryEvent(details);
    fire("click", openClick);
    expect(openClick.preventDefault).toHaveBeenCalled();
    expect(state.ui.manualReportDetailsOpen).toBe(true);
    expect(details.open).toBe(true);
    expect(details.innerHTML).toContain("перд");

    details.open = false;
    fire("click", summaryEvent(details));
    expect(state.ui.manualReportDetailsOpen).toBe(false);
    expect(details.open).toBe(false);
    expect(details.innerHTML).not.toContain("перд");

    details.open = true;
    fire("toggle", { target: details });
    expect(details.open).toBe(false);
    expect(state.ui.manualReportDetailsOpen).toBe(false);
    await settle();
    expect(details.open).toBe(false);
  });

  it("toggle браузера не раскрывает «Исправлено автоматически» обратно", async () => {
    const details = section("reportDetails");
    fire("click", summaryEvent(details));
    expect(details.open).toBe(true);
    expect(details.innerHTML).toContain("ЦИАН");

    fire("click", summaryEvent(details));
    expect(details.open).toBe(false);
    expect(details.innerHTML).not.toContain("ЦИАН");

    details.open = true;
    fire("toggle", { target: details });
    await settle();
    expect(details.open).toBe(false);
    expect(state.ui.reportDetailsOpen).toBe(false);
    expect(details.innerHTML).not.toContain("ЦИАН");
  });
});
