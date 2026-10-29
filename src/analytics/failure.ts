import type { AnalyticsErrorCode, AnalyticsErrorStage } from "./schema";

function visibleMessage(error: unknown): string {
  try {
    return error instanceof Error ? String(error.message) : String(error);
  } catch {
    return "Не удалось выполнить действие";
  }
}

/** Local context only. The underlying error never enters an analytics envelope. */
export class AnalyticsFailure extends Error {
  constructor(
    readonly stage: AnalyticsErrorStage,
    readonly code: AnalyticsErrorCode,
    readonly original: unknown,
  ) {
    super(visibleMessage(original));
  }
}

/** Annotate at the origin; only the operation boundary reports a thrown failure. */
export function annotateFailure(
  error: unknown, stage: AnalyticsErrorStage, code: AnalyticsErrorCode,
): AnalyticsFailure {
  return error instanceof AnalyticsFailure ? error : new AnalyticsFailure(stage, code, error);
}
