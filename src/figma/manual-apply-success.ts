import { isChoicePolicy } from "../core/apply-policy";
import { isOrthographyRuleId } from "../rules/orthography-spell-rules";
import { capitalizeLike } from "../shared/case";
import type { TextFixDto } from "../shared/messages";
import { rangesOverlap } from "../shared/ranges-overlap";
import {
  findResolutionPositions,
  type ChoiceResolution,
} from "./choice-resolution-core";

/**
 * С этой даты клиент отличает намерение, решение и фактическое изменение.
 * Строки events до выкладки этой логики не пересчитываются: у Community v22
 * (`plugin_version` 0.22.0) `applied`/`confirmed` означали нажатие, не результат.
 */
export const MANUAL_APPLY_SUCCESS_SEMANTICS_SINCE = "2026-10-23";

export type ManualApplySuccess =
  | {
      track: "text_changed";
      event: "manual_fix_complete";
      action: "applied";
      kind: "confirm" | "orthography";
    }
  | {
      track: "decision_saved";
      event: "choice_resolved";
      action: "confirmed";
    }
  | {
      track: "none";
      reason:
        | "missing_layer"
        | "exception"
        | "stale"
        | "empty"
        | "unchanged"
        | "repeat"
        | "decision_not_saved"
        | "not_allowed";
    };

export type ManualApplyObservation = {
  layerFound: boolean;
  /** Применение или запись решения бросили исключение. Успех при этом не начисляется. */
  threw: boolean;
  /** Текст слоя до попытки применения. */
  layerTextBefore: string | null;
  /** Сколько правок реально записал общий apply. */
  appliedCount: number;
  /** Запись решения о форме завершилась. Для обычной замены не требуется. */
  resolutionSaved: boolean;
  /** То же решение исходной формы уже лежало на слое до этого вызова. */
  alreadySavedDecision: boolean;
};

function fragmentAt(text: string, from: number, to: number): string {
  return text.slice(from, to);
}

/** Выбранная форма есть среди вариантов карточки, с тем же регистром, что у слова в слое. */
export function isAllowedChosenForm(fix: TextFixDto): boolean {
  if (!isChoicePolicy(fix.rule.applyPolicy) || fix.after.length === 0) return false;
  const options = fix.rule.choiceOptions ?? [];
  if (options.length === 0) return false;
  return options.some(
    (option) => option === fix.after || capitalizeLike(fix.before, option) === fix.after,
  );
}

/** Повтор: эта форма этого правила уже сохранена на том же месте. */
export function hasSavedChoiceDecision(
  text: string,
  resolutions: ChoiceResolution[],
  fix: Pick<TextFixDto, "from" | "to" | "after" | "rule">,
): boolean {
  if (!fix.after) return false;
  return resolutions.some((resolution) => {
    if (resolution.ruleId !== fix.rule.id || resolution.chosen !== fix.after) return false;
    return findResolutionPositions(text, resolution).some(({ from, to }) => {
      if (!rangesOverlap(fix.from, fix.to, from, to)) return false;
      return text.slice(from, to) === fix.after;
    });
  });
}

function unchangedOrStaleOrEmpty(
  fix: TextFixDto,
  layerTextBefore: string | null,
): ManualApplySuccess {
  if (layerTextBefore == null) return { track: "none", reason: "empty" };
  const slice = fragmentAt(layerTextBefore, fix.from, fix.to);
  if (fix.before !== fix.after && slice === fix.after) return { track: "none", reason: "repeat" };
  if (slice !== fix.before) return { track: "none", reason: "stale" };
  if (fix.before === fix.after) return { track: "none", reason: "unchanged" };
  return { track: "none", reason: "empty" };
}

/**
 * Намерение (клик) само по себе успехом не является.
 * Изменение текста и сохранённое решение о форме — разные исходы; второй не маскируется под первое.
 */
export function classifyManualApplySuccess(
  fix: TextFixDto,
  observation: ManualApplyObservation,
): ManualApplySuccess {
  if (!observation.layerFound) return { track: "none", reason: "missing_layer" };
  if (observation.threw) return { track: "none", reason: "exception" };

  if (isChoicePolicy(fix.rule.applyPolicy)) {
    if (!isAllowedChosenForm(fix)) return { track: "none", reason: "not_allowed" };
    const keptOriginal = fix.before === fix.after;
    if (keptOriginal) {
      if (
        observation.layerTextBefore != null &&
        fragmentAt(observation.layerTextBefore, fix.from, fix.to) !== fix.before
      ) {
        return { track: "none", reason: "stale" };
      }
      if (observation.alreadySavedDecision) return { track: "none", reason: "repeat" };
      if (!observation.resolutionSaved) return { track: "none", reason: "decision_not_saved" };
      return { track: "decision_saved", event: "choice_resolved", action: "confirmed" };
    }
    if (observation.appliedCount > 0) {
      if (!observation.resolutionSaved) return { track: "none", reason: "decision_not_saved" };
      return { track: "decision_saved", event: "choice_resolved", action: "confirmed" };
    }
    return unchangedOrStaleOrEmpty(fix, observation.layerTextBefore);
  }

  if (observation.appliedCount > 0) {
    return {
      track: "text_changed",
      event: "manual_fix_complete",
      action: "applied",
      kind: isOrthographyRuleId(fix.rule.id) ? "orthography" : "confirm",
    };
  }
  return unchangedOrStaleOrEmpty(fix, observation.layerTextBefore);
}
