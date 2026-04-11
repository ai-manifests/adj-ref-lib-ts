export interface CalibrationScore {
  readonly value: number;
  readonly sampleSize: number;
  readonly staleness: number; // milliseconds
}

export interface ScoringPair {
  readonly confidence: number;
  readonly outcome: number;
  readonly timestamp: number; // epoch ms
}

export function computeCalibration(pairs: readonly ScoringPair[], now: number): CalibrationScore {
  if (pairs.length === 0) return getDefaultCalibration();

  let brierSum = 0;
  let mostRecent = 0;
  for (const p of pairs) {
    const diff = p.confidence - p.outcome;
    brierSum += diff * diff;
    if (p.timestamp > mostRecent) mostRecent = p.timestamp;
  }

  const brier = brierSum / pairs.length;
  const staleness = Math.max(0, now - mostRecent);

  return {
    value: Math.max(0, Math.min(1, 1 - brier)),
    sampleSize: pairs.length,
    staleness,
  };
}

export function updateCalibration(prior: CalibrationScore, pair: ScoringPair, now: number): CalibrationScore {
  const priorBrier = 1 - prior.value;
  const diff = pair.confidence - pair.outcome;
  const contribution = diff * diff;
  const newN = prior.sampleSize + 1;
  const newBrier = (prior.sampleSize * priorBrier + contribution) / newN;
  const staleness = Math.max(0, now - pair.timestamp);

  return {
    value: Math.max(0, Math.min(1, 1 - newBrier)),
    sampleSize: newN,
    staleness,
  };
}

export function getDefaultCalibration(): CalibrationScore {
  return { value: 0.5, sampleSize: 0, staleness: 0 };
}
