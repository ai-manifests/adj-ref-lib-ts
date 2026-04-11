import type { ConditionRecord } from './entries.js';

export interface ConditionQualityMetrics {
  readonly falsificationRatio: number;
  readonly amendmentFrequency: number;
  readonly conditionsPublished: number;
  readonly conditionsTested: number;
  readonly totalAmendments: number;
}

export function computeConditionQuality(conditions: readonly ConditionRecord[]): ConditionQualityMetrics {
  if (conditions.length === 0) {
    return { falsificationRatio: 0, amendmentFrequency: 0, conditionsPublished: 0, conditionsTested: 0, totalAmendments: 0 };
  }

  let tested = 0;
  let totalAmendments = 0;
  for (const c of conditions) {
    if (c.testedInRound != null) tested++;
    totalAmendments += c.amendmentCount;
  }

  return {
    falsificationRatio: tested / conditions.length,
    amendmentFrequency: totalAmendments / conditions.length,
    conditionsPublished: conditions.length,
    conditionsTested: tested,
    totalAmendments,
  };
}
