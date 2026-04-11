import { describe, it, expect } from 'vitest';
import {
  InMemoryJournalStore, computeConditionQuality, updateCalibration, getDefaultCalibration,
  type JournalEntry, type DeliberationOpened, type ProposalEmitted, type RoundEvent,
  type DeliberationClosed, type OutcomeObserved, type ConditionRecord, type CalibrationScore,
} from '../src/index.js';

const DLB = 'dlb_01HMXJ3E9R';
const TEST_RUNNER = 'did:adp:test-runner-v2';
const SCANNER = 'did:adp:security-scanner-v3';
const LINTER = 'did:adp:style-linter-v1';
const T0 = '2026-04-11T14:32:00Z';
const T_OUTCOME = '2026-04-14T09:12:00Z';

function ts(offsetSec: number): string {
  return new Date(new Date(T0).getTime() + offsetSec * 1000).toISOString();
}

function buildJournal(): InMemoryJournalStore {
  const store = new InMemoryJournalStore();
  const action = { kind: 'merge_pull_request', target: 'github.com/acme/api#4471', parameters: { strategy: 'squash' } };

  store.append({ entryType: 'deliberation_opened', entryId: 'adj_01', deliberationId: DLB, timestamp: T0, priorEntryHash: null, decisionClass: 'code.correctness', action, participants: [TEST_RUNNER, SCANNER, LINTER], config: { maxRounds: 3, participationFloor: 0.50 } } as DeliberationOpened);

  store.append({ entryType: 'proposal_emitted', entryId: 'adj_02', deliberationId: DLB, timestamp: ts(9), priorEntryHash: null, proposal: { proposalId: 'prp_01', agentId: TEST_RUNNER, vote: 'approve', confidence: 0.86, domain: 'code.correctness', calibrationAtStake: true, dissentConditions: [{ id: 'dc_tr_01', condition: 'if any test regresses', status: 'active', amendmentCount: 0, testedInRound: null }, { id: 'dc_tr_02', condition: 'if coverage negative', status: 'active', amendmentCount: 0, testedInRound: null }] } } as ProposalEmitted);

  store.append({ entryType: 'proposal_emitted', entryId: 'adj_03', deliberationId: DLB, timestamp: ts(11), priorEntryHash: null, proposal: { proposalId: 'prp_02', agentId: SCANNER, vote: 'reject', confidence: 0.79, domain: 'security.policy', calibrationAtStake: true, dissentConditions: [{ id: 'dc_ss_01', condition: 'if auth untested', status: 'active', amendmentCount: 0, testedInRound: null }, { id: 'dc_ss_02', condition: 'if no security test', status: 'active', amendmentCount: 0, testedInRound: null }] } } as ProposalEmitted);

  store.append({ entryType: 'proposal_emitted', entryId: 'adj_04', deliberationId: DLB, timestamp: ts(12), priorEntryHash: null, proposal: { proposalId: 'prp_03', agentId: LINTER, vote: 'approve', confidence: 0.62, domain: 'code.style', calibrationAtStake: true, dissentConditions: [{ id: 'dc_sl_01', condition: 'if API naming violated', status: 'active', amendmentCount: 0, testedInRound: null }] } } as ProposalEmitted);

  const roundEvents: [string, string, string, string | null, string | null][] = [
    ['adj_05', 'falsification_evidence', TEST_RUNNER, SCANNER, 'dc_ss_01'],
    ['adj_06', 'falsification_evidence', TEST_RUNNER, SCANNER, 'dc_ss_02'],
    ['adj_07', 'acknowledge', SCANNER, null, 'dc_ss_01'],
    ['adj_08', 'acknowledge', SCANNER, null, 'dc_ss_02'],
    ['adj_09', 'revise', SCANNER, null, null],
  ];
  roundEvents.forEach(([id, kind, agent, target, cond], i) => {
    store.append({ entryType: 'round_event', entryId: id, deliberationId: DLB, timestamp: ts(135 + i), priorEntryHash: null, round: 1, eventKind: kind, agentId: agent, targetAgentId: target, targetConditionId: cond } as RoundEvent);
  });

  store.append({ entryType: 'deliberation_closed', entryId: 'adj_10', deliberationId: DLB, timestamp: ts(210), priorEntryHash: null, termination: 'converged', roundCount: 1, tier: 'partially_reversible', finalTally: { approveWeight: 0.89, rejectWeight: 0, abstainWeight: 0.64, totalWeight: 1.53, approvalFraction: 1.0, participationFraction: 0.582, threshold: 0.60 }, weights: { [TEST_RUNNER]: 0.71, [SCANNER]: 0.64, [LINTER]: 0.18 }, committedAction: action } as DeliberationClosed);

  return store;
}

function addOutcome(store: InMemoryJournalStore, success: number, entryId = 'adj_11'): void {
  store.append({ entryType: 'outcome_observed', entryId, deliberationId: DLB, timestamp: '2026-04-14T09:15:00Z', priorEntryHash: null, observedAt: T_OUTCOME, outcomeClass: 'binary', success, evidenceRefs: ['ci:github-actions/run/8835001'], reporterId: 'did:adp:ci-monitor-v1', reporterConfidence: 0.95, groundTruth: true } as OutcomeObserved);
}

describe('ADJ PR Merge Journal', () => {
  it('full deliberation has 10 entries', () => {
    expect(buildJournal().getDeliberation(DLB)).toHaveLength(10);
  });

  it('no outcome before recording', () => {
    expect(buildJournal().getOutcome(DLB)).toBeNull();
  });

  it('calibration returns bootstrap before outcome', () => {
    const cal = buildJournal().getCalibration(TEST_RUNNER, 'code.correctness');
    expect(cal.value).toBe(0.5);
    expect(cal.sampleSize).toBe(0);
  });

  it('outcome recorded and retrievable', () => {
    const store = buildJournal();
    addOutcome(store, 1.0);
    const outcome = store.getOutcome(DLB);
    expect(outcome).not.toBeNull();
    expect(outcome!.success).toBe(1.0);
    expect(outcome!.groundTruth).toBe(true);
  });

  it('calibration updates after outcome match spec §9.2', () => {
    const store = buildJournal();
    addOutcome(store, 1.0);

    const tr = store.getCalibration(TEST_RUNNER, 'code.correctness');
    expect(tr.sampleSize).toBe(1);
    expect(tr.value).toBeGreaterThanOrEqual(0.97);
    expect(tr.value).toBeLessThanOrEqual(0.99);

    const sc = store.getCalibration(SCANNER, 'security.policy');
    expect(sc.sampleSize).toBe(1);
    expect(sc.value).toBeGreaterThanOrEqual(0.95);
    expect(sc.value).toBeLessThanOrEqual(0.97);

    const lt = store.getCalibration(LINTER, 'code.style');
    expect(lt.sampleSize).toBe(1);
    expect(lt.value).toBeGreaterThanOrEqual(0.84);
    expect(lt.value).toBeLessThanOrEqual(0.87);
  });

  it('incremental Brier update matches spec', () => {
    const prior: CalibrationScore = { value: 0.85, sampleSize: 312, staleness: 18 * 86400000 };
    const updated = updateCalibration(prior, { confidence: 0.86, outcome: 1.0, timestamp: new Date(T_OUTCOME).getTime() }, new Date(T_OUTCOME).getTime());
    expect(updated.sampleSize).toBe(313);
    expect(updated.value).toBeGreaterThanOrEqual(0.849);
    expect(updated.value).toBeLessThanOrEqual(0.852);
  });

  it('condition quality tracks falsification ratio', () => {
    const conditions: ConditionRecord[] = [
      { id: 'dc_01', condition: 'x', status: 'falsified', amendmentCount: 0, testedInRound: 1 },
      { id: 'dc_02', condition: 'y', status: 'falsified', amendmentCount: 0, testedInRound: 1 },
    ];
    const m = computeConditionQuality(conditions);
    expect(m.falsificationRatio).toBe(1.0);
    expect(m.conditionsTested).toBe(2);
  });

  it('detects untestable conditions', () => {
    const conditions: ConditionRecord[] = Array.from({ length: 10 }, (_, i) => ({
      id: `dc_${i}`, condition: `c${i}`, status: i < 2 ? 'falsified' : 'active',
      amendmentCount: 0, testedInRound: i < 2 ? 1 : null,
    }));
    const m = computeConditionQuality(conditions);
    expect(m.falsificationRatio).toBe(0.2);
  });

  it('bootstrap agent gets default', () => {
    const cal = new InMemoryJournalStore().getCalibration('did:adp:new', 'x');
    expect(cal.value).toBe(0.5);
    expect(cal.sampleSize).toBe(0);
    expect(cal.staleness).toBe(0);
  });

  it('outcome supersedes replaces prior', () => {
    const store = buildJournal();
    addOutcome(store, 1.0);
    store.append({ entryType: 'outcome_observed', entryId: 'adj_12', deliberationId: DLB, timestamp: '2026-04-15T09:15:00Z', priorEntryHash: null, observedAt: '2026-04-14T15:12:00Z', outcomeClass: 'binary', success: 0.0, evidenceRefs: ['incident:INC-8823'], reporterId: 'did:adp:incident-v1', reporterConfidence: 0.99, groundTruth: true, supersedes: 'adj_11' } as OutcomeObserved);

    const outcome = store.getOutcome(DLB);
    expect(outcome!.success).toBe(0.0);

    const cal = store.getCalibration(TEST_RUNNER, 'code.correctness');
    expect(cal.value).toBeGreaterThanOrEqual(0.25);
    expect(cal.value).toBeLessThanOrEqual(0.27);
  });
});
