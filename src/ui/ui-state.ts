import type {
  AutoApplyReportDto,
  CheckedTextLayerDto,
  LexiconLoadStatusDto,
  TextNodeCardDto,
} from "../shared/messages";

export type UiAccordionState = {
  confirmDetailsOpen: boolean;
  choiceDetailsOpen: boolean;
  reportDetailsOpen: boolean;
  manualReportDetailsOpen: boolean;
  textLayersDetailsOpen: boolean;
  techDetailsOpen: boolean;
};

export type UiState = {
  summary: {
    checkedLayers: number;
    foundFixes: number;
    confirmFixes: number;
    choiceFixes: number;
  } | null;
  checkedTextLayers: CheckedTextLayerDto[];
  cards: TextNodeCardDto[];
  confirmCards: TextNodeCardDto[];
  choiceCards: TextNodeCardDto[];
  lastReport: AutoApplyReportDto | null;
  lastManualReport: AutoApplyReportDto | null;
  lexiconLoad: LexiconLoadStatusDto | null;
  /** Пока грузится / крутится Hunspell после auto-apply. */
  spellcheckInProgress: boolean;
  /** Пользовательский преф орфографии (toggle в шапке). */
  spellcheckEnabled: boolean;
  ui: UiAccordionState;
  /** Выбранный вариант choice-правки: ключ «cardIdx:fixIdx» → индекс опции. */
  choiceSelection: Record<string, number>;
};

export const state: UiState = {
  summary: null,
  checkedTextLayers: [],
  cards: [],
  confirmCards: [],
  choiceCards: [],
  lastReport: null,
  lastManualReport: null,
  lexiconLoad: null,
  spellcheckInProgress: false,
  spellcheckEnabled: false,
  ui: {
    confirmDetailsOpen: true,
    choiceDetailsOpen: true,
    reportDetailsOpen: false,
    manualReportDetailsOpen: false,
    textLayersDetailsOpen: false,
    techDetailsOpen: false,
  },
  choiceSelection: {},
};

export function choiceSelectionKey(cardIdx: number, fixIdx: number): string {
  return `${cardIdx}:${fixIdx}`;
}

export function mapTextNodeCard(
  card: TextNodeCardDto,
): TextNodeCardDto {
  return {
    nodeId: card.nodeId,
    nodeName: card.nodeName,
    originalText: card.originalText,
    previewText: card.previewText,
    characterCount: card.characterCount,
    fixes: card.fixes,
  };
}

export function resetForError(): void {
  state.summary = null;
  state.checkedTextLayers = [];
  state.lastReport = null;
  state.lastManualReport = null;
  state.cards = [];
  state.spellcheckInProgress = false;
}

export function applySpellcheckStatus(active: boolean): void {
  state.spellcheckInProgress = active;
}

export function applyCheckResult(result: {
  summary: UiState["summary"];
  checkedTextLayers: CheckedTextLayerDto[];
  lastAutoApplyReport: AutoApplyReportDto | null;
  lastManualApplyReport: AutoApplyReportDto | null;
  cards: TextNodeCardDto[];
  confirmCards: TextNodeCardDto[];
  choiceCards: TextNodeCardDto[];
}): void {
  state.choiceSelection = {};
  state.summary = result.summary;
  state.checkedTextLayers = result.checkedTextLayers || [];
  state.lastReport = result.lastAutoApplyReport;
  state.lastManualReport = result.lastManualApplyReport;
  state.cards = result.cards.map(mapTextNodeCard);
  state.confirmCards = (result.confirmCards || []).map(mapTextNodeCard);
  state.choiceCards = (result.choiceCards || []).map(mapTextNodeCard);
}

export function applyLexiconConfig(lexiconLoad: LexiconLoadStatusDto | null): void {
  state.lexiconLoad = lexiconLoad;
}

export function applySpellcheckPreference(enabled: boolean): void {
  state.spellcheckEnabled = Boolean(enabled);
}

export function captureUiAccordionState(): void {
  const confirmEl = document.querySelector("details.confirmDetails");
  if (confirmEl instanceof HTMLDetailsElement) state.ui.confirmDetailsOpen = confirmEl.open;
  const choiceEl = document.querySelector("details.choiceDetails");
  if (choiceEl instanceof HTMLDetailsElement) state.ui.choiceDetailsOpen = choiceEl.open;
  const reportEl = document.querySelector("details.reportDetails");
  if (reportEl instanceof HTMLDetailsElement) state.ui.reportDetailsOpen = reportEl.open;
  const manualReportEl = document.querySelector("details.manualReportDetails");
  if (manualReportEl instanceof HTMLDetailsElement) {
    state.ui.manualReportDetailsOpen = manualReportEl.open;
  }
  const textLayersEl = document.querySelector("details.textLayersDetails");
  if (textLayersEl instanceof HTMLDetailsElement) {
    state.ui.textLayersDetailsOpen = textLayersEl.open;
  }
  const techEl = document.querySelector("details.techDetails");
  if (techEl instanceof HTMLDetailsElement) state.ui.techDetailsOpen = techEl.open;
}

export function syncAccordionStateFromElement(el: Element): void {
  if (el.classList.contains("confirmDetails")) {
    state.ui.confirmDetailsOpen = (el as HTMLDetailsElement).open;
  } else if (el.classList.contains("choiceDetails")) {
    state.ui.choiceDetailsOpen = (el as HTMLDetailsElement).open;
  } else if (el.classList.contains("reportDetails")) {
    state.ui.reportDetailsOpen = (el as HTMLDetailsElement).open;
  } else if (el.classList.contains("manualReportDetails")) {
    state.ui.manualReportDetailsOpen = (el as HTMLDetailsElement).open;
  } else if (el.classList.contains("textLayersDetails")) {
    state.ui.textLayersDetailsOpen = (el as HTMLDetailsElement).open;
  } else if (el.classList.contains("techDetails")) {
    state.ui.techDetailsOpen = (el as HTMLDetailsElement).open;
  }
}
