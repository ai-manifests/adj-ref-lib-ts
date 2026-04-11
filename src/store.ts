import type { JournalEntry, ProposalEmitted, OutcomeObserved, ConditionRecord } from './entries.js';
import type { CalibrationScore, ScoringPair } from './scoring.js';
import { computeCalibration, getDefaultCalibration } from './scoring.js';
import type { ConditionQualityMetrics } from './condition-quality.js';
import { computeConditionQuality } from './condition-quality.js';

export interface JournalStore {
  getCalibration(agentId: string, domain: string): CalibrationScore;
  getDeliberation(deliberationId: string): JournalEntry[];
  getOutcome(deliberationId: string): OutcomeObserved | null;
  getConditionTrace(agentId: string, windowMs: number): ConditionQualityMetrics;
}

export class InMemoryJournalStore implements JournalStore {
  private readonly entries: JournalEntry[] = [];

  append(entry: JournalEntry): void {
    this.entries.push(entry);
  }

  appendRange(entries: JournalEntry[]): void {
    this.entries.push(...entries);
  }

  getCalibration(agentId: string, domain: string): CalibrationScore {
    const pairs = this.getScoringPairs(agentId, domain);
    if (pairs.length === 0) return getDefaultCalibration();
    return computeCalibration(pairs, Date.now());
  }

  getDeliberation(deliberationId: string): JournalEntry[] {
    return this.entries
      .filter(e => e.deliberationId === deliberationId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  getOutcome(deliberationId: string): OutcomeObserved | null {
    const outcomes = this.entries.filter(
      (e): e is OutcomeObserved => e.entryType === 'outcome_observed' && e.deliberationId === deliberationId,
    );
    if (outcomes.length === 0) return null;
    return outcomes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }

  getConditionTrace(agentId: string, windowMs: number): ConditionQualityMetrics {
    const cutoff = Date.now() - windowMs;
    const conditions: ConditionRecord[] = [];
    for (const e of this.entries) {
      if (e.entryType === 'proposal_emitted' && e.proposal.agentId === agentId && new Date(e.timestamp).getTime() >= cutoff) {
        conditions.push(...e.proposal.dissentConditions);
      }
    }
    return computeConditionQuality(conditions);
  }

  getAllEntries(): JournalEntry[] {
    return [...this.entries];
  }

  private getScoringPairs(agentId: string, domain: string): ScoringPair[] {
    const proposals = this.entries.filter(
      (e): e is ProposalEmitted =>
        e.entryType === 'proposal_emitted' &&
        e.proposal.agentId === agentId &&
        e.proposal.domain === domain &&
        e.proposal.calibrationAtStake,
    );

    const outcomeMap = new Map<string, OutcomeObserved>();
    for (const e of this.entries) {
      if (e.entryType === 'outcome_observed') {
        const existing = outcomeMap.get(e.deliberationId);
        if (!existing || new Date(e.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
          outcomeMap.set(e.deliberationId, e);
        }
      }
    }

    const pairs: ScoringPair[] = [];
    for (const p of proposals) {
      const outcome = outcomeMap.get(p.deliberationId);
      if (outcome) {
        pairs.push({
          confidence: p.proposal.confidence,
          outcome: outcome.success,
          timestamp: new Date(outcome.observedAt).getTime(),
        });
      }
    }
    return pairs;
  }
}
