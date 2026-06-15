export type CheckSummary = {
  checkedLayers: number;
  foundFixes: number;
};

export type RuleInfo = {
  id: string;
  category: string;
  message: string;
  priority: number;
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
  fixes: TextFixDto[];
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
  cards: TextNodeCardDto[];
  /** Отчёт о автоисправлении (может объединять несколько проходов). */
  lastAutoApplyReport?: AutoApplyReportDto | null;
};

/** Запуск без фреймов, в которых есть текст. */
export const NO_TEXT_IN_SELECTION_NOTICE =
  "Выберите хотя бы один фрейм с текстовыми полями";

export type SheetLoadStatusDto = {
  ok: boolean;
  ruleCount: number;
  fromRemote: boolean;
  /** Строк правил из Google Таблицы. */
  remoteRuleCount?: number;
  /** Строк правил только из локального CSV (не дублируют таблицу). */
  bundledOnlyRuleCount?: number;
  errorMessage?: string;
  fetchUrl?: string;
};

export type UiToPluginMessage =
  | { type: "ui:ready" }
  | { type: "ui:focusLayer"; nodeId: string }
  | { type: "ui:close" }
  | {
      type: "ui:sheetCsvResult";
      requestId: string;
      ok: boolean;
      csv?: string;
      errorMessage?: string;
      fetchUrl: string;
    };

export type PluginToUiMessage =
  | { type: "plugin:checkResult"; result: CheckResultDto }
  | { type: "plugin:error"; message: string }
  | {
      type: "plugin:fetchSheetCsv";
      requestId: string;
      spreadsheetId: string;
      gid: string;
      fetchUrl: string;
    }
  | { type: "plugin:config"; sheetLoad?: SheetLoadStatusDto | null };

