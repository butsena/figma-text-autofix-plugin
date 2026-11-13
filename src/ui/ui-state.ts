import type {
  AutoApplyReportDto,
  AutofixProgressDto,
  CheckedTextLayerDto,
  LexiconLoadStatusDto,
  TextNodeCardDto,
} from "../shared/messages";
import { FIX_ROW_PAGE } from "./list-window";

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
  /** Полоска под «Шуршу по макету...», пока результат ещё не пришёл. */
  autofixProgress: AutofixProgressDto | null;
  /** Сколько строк автоотчёта и «Вы исправили» уже показано. */
  reportShown: number;
  manualReportShown: number;
  /** Ключ «confirm:id» / «choice:id» → сколько карточек этого типа уже показано. Нет ключа — первые 10. */
  expandedGroups: Record<string, number>;
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
  autofixProgress: null,
  reportShown: FIX_ROW_PAGE,
  manualReportShown: FIX_ROW_PAGE,
  expandedGroups: {},
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
  state.autofixProgress = null;
  state.expandedGroups = {};
  state.reportShown = FIX_ROW_PAGE;
  state.manualReportShown = FIX_ROW_PAGE;
}

export function applyAutofixProgress(progress: AutofixProgressDto): void {
  state.autofixProgress = progress;
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
  state.autofixProgress = null;
  state.expandedGroups = {};
  state.reportShown = FIX_ROW_PAGE;
  state.manualReportShown = FIX_ROW_PAGE;
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
  if (typeof HTMLDetailsElement !== "undefined" && !(el instanceof HTMLDetailsElement)) return;
  setDetailsOpen(el, "open" in el && Boolean((el as HTMLDetailsElement).open));
}

/** Заголовки секций, которые сами решают, открыты они или нет. */
export function setDetailsOpen(el: Element, open: boolean): boolean {
  if (el.classList.contains("confirmDetails")) state.ui.confirmDetailsOpen = open;
  else if (el.classList.contains("choiceDetails")) state.ui.choiceDetailsOpen = open;
  else if (el.classList.contains("manualReportDetails")) state.ui.manualReportDetailsOpen = open;
  else if (el.classList.contains("reportDetails")) state.ui.reportDetailsOpen = open;
  else if (el.classList.contains("textLayersDetails")) state.ui.textLayersDetailsOpen = open;
  else if (el.classList.contains("techDetails")) state.ui.techDetailsOpen = open;
  else return false;
  return true;
}

/** Состояние секции в модели, не свойство DOM: браузер к клику уже мог его переключить. */
export function readDetailsOpen(el: Element): boolean | null {
  if (el.classList.contains("confirmDetails")) return state.ui.confirmDetailsOpen;
  if (el.classList.contains("choiceDetails")) return state.ui.choiceDetailsOpen;
  if (el.classList.contains("manualReportDetails")) return state.ui.manualReportDetailsOpen;
  if (el.classList.contains("reportDetails")) return state.ui.reportDetailsOpen;
  if (el.classList.contains("textLayersDetails")) return state.ui.textLayersDetailsOpen;
  if (el.classList.contains("techDetails")) return state.ui.techDetailsOpen;
  return null;
}

export function detailsStateSelector(el: Element): string | null {
  if (el.classList.contains("confirmDetails")) return "details.confirmDetails";
  if (el.classList.contains("choiceDetails")) return "details.choiceDetails";
  if (el.classList.contains("manualReportDetails")) return "details.manualReportDetails";
  if (el.classList.contains("reportDetails")) return "details.reportDetails";
  if (el.classList.contains("textLayersDetails")) return "details.textLayersDetails";
  if (el.classList.contains("techDetails")) return "details.techDetails";
  return null;
}
