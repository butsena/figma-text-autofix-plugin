import type { ApplyPolicy } from "../core/apply-policy";

export type CheckSummary = {
  checkedLayers: number;
  /** Автоправки (ещё не применённые после прохода). */
  foundFixes: number;
  /** Правки, ожидающие подтверждения. */
  confirmFixes: number;
  /** Правки с выбором равноправных вариантов. */
  choiceFixes: number;
};

export type RuleInfo = {
  id: string;
  category: string;
  message: string;
  hint?: string;
  choiceOptions?: string[];
  priority: number;
  applyPolicy: ApplyPolicy;
};

export type TextFixDto = {
  fixId: string;
  from: number;
  to: number;
  before: string;
  after: string;
  rule: RuleInfo;
};

export type TextNodeCardDto = {
  nodeId: string;
  nodeName: string;
  originalText: string;
  previewText: string;
  /** Длина текста слоя на момент сканирования. */
  characterCount: number;
  fixes: TextFixDto[];
};

/** Текстовый слой из выделения (счётчик символов — всегда, независимо от правок). */
export type CheckedTextLayerDto = {
  nodeId: string;
  nodeName: string;
  characterCount: number;
};

/** Одна применённая замена (для отчёта после автоприменения). */
export type AutoApplyFixLineDto = {
  fixId: string;
  ruleId: string;
  category: string;
  message: string;
  before: string;
  after: string;
  from: number;
  to: number;
  /** Текст слоя на момент обнаружения правки (для контекста в UI). */
  sourceText: string;
};

export type AutoApplyLayerReportDto = {
  nodeId: string;
  nodeName: string;
  /** Длина текста слоя после применённых правок в этом отчёте. */
  characterCount: number;
  fixes: AutoApplyFixLineDto[];
};

export type AutoApplyReportDto = {
  summary: {
    checkedLayers: number;
    /** Сколько отдельных замен применено к тексту (может быть меньше найденных, если слой не найден). */
    appliedFixCount: number;
    /** Сколько текстовых слоёв получили хотя бы одну замену. */
    changedLayerCount: number;
  };
  layers: AutoApplyLayerReportDto[];
};

export type CheckResultDto = {
  summary: CheckSummary;
  /** Все проверенные текстовые слои с длиной текста. */
  checkedTextLayers: CheckedTextLayerDto[];
  cards: TextNodeCardDto[];
  /** Правки, требующие подтверждения пользователя. */
  confirmCards: TextNodeCardDto[];
  /** Правки с выбором равноправных вариантов. */
  choiceCards: TextNodeCardDto[];
  /** Отчёт о автоисправлении (может объединять несколько проходов). */
  lastAutoApplyReport?: AutoApplyReportDto | null;
};

/** Запуск без фреймов, в которых есть текст. */
export const NO_TEXT_IN_SELECTION_NOTICE =
  "Выберите хотя бы один фрейм с текстовыми полями";

export type LexiconResourceLoadStatus = {
  ok: boolean;
  count: number;
  fromRemote: boolean;
  errorMessage?: string;
  fetchUrl?: string;
};

export type LexiconLoadStatusDto = {
  replacements: LexiconResourceLoadStatus;
  boundaryExceptions: LexiconResourceLoadStatus;
  spellSupplement: LexiconResourceLoadStatus;
  spellWhitelist: LexiconResourceLoadStatus;
};

/** @deprecated Используйте LexiconLoadStatusDto. */
export type SheetLoadStatusDto = LexiconLoadStatusDto;

export type UiToPluginMessage =
  | { type: "ui:ready" }
  | { type: "ui:focusLayer"; nodeId: string }
  | { type: "ui:close" }
  | {
      type: "ui:applyManualFix";
      nodeId: string;
      fix: TextFixDto;
    }
  | {
      type: "ui:resize";
      width: number;
      height: number;
    };

export type PluginToUiMessage =
  | { type: "plugin:checkResult"; result: CheckResultDto }
  | { type: "plugin:error"; message: string }
  | { type: "plugin:config"; lexiconLoad?: LexiconLoadStatusDto | null };

