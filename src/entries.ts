export interface ActionDescriptor {
  readonly kind: string;
  readonly target: string;
  readonly parameters?: Readonly<Record<string, string>>;
}

export interface TallyRecord {
  readonly approveWeight: number;
  readonly rejectWeight: number;
  readonly abstainWeight: number;
  readonly totalWeight: number;
  readonly approvalFraction: number;
  readonly participationFraction: number;
  readonly threshold: number;
}

export interface ConditionRecord {
  readonly id: string;
  readonly condition: string;
  readonly status: string;
  readonly amendmentCount: number;
  readonly testedInRound: number | null;
}

export interface ProposalData {
  readonly proposalId: string;
  readonly agentId: string;
  readonly vote: string;
  readonly confidence: number;
  readonly domain: string;
  readonly calibrationAtStake: boolean;
  readonly dissentConditions: readonly ConditionRecord[];
}

export interface DeliberationConfig {
  readonly maxRounds: number;
  readonly participationFloor: number;
}

interface BaseEntry {
  readonly entryId: string;
  readonly deliberationId: string;
  readonly timestamp: string;
  readonly priorEntryHash: string | null;
}

export interface DeliberationOpened extends BaseEntry {
  readonly entryType: 'deliberation_opened';
  readonly decisionClass: string;
  readonly action: ActionDescriptor;
  readonly participants: readonly string[];
  readonly config?: DeliberationConfig;
}

export interface ProposalEmitted extends BaseEntry {
  readonly entryType: 'proposal_emitted';
  readonly proposal: ProposalData;
}

export interface RoundEvent extends BaseEntry {
  readonly entryType: 'round_event';
  readonly round: number;
  readonly eventKind: string;
  readonly agentId: string;
  readonly targetAgentId: string | null;
  readonly targetConditionId: string | null;
  readonly payload?: Record<string, unknown>;
}

export interface DeliberationClosed extends BaseEntry {
  readonly entryType: 'deliberation_closed';
  readonly termination: 'converged' | 'partial_commit' | 'deadlocked';
  readonly roundCount: number;
  readonly tier: string;
  readonly finalTally: TallyRecord;
  readonly weights: Readonly<Record<string, number>>;
  readonly committedAction: ActionDescriptor | null;
}

export interface OutcomeObserved extends BaseEntry {
  readonly entryType: 'outcome_observed';
  readonly observedAt: string;
  readonly outcomeClass: 'binary' | 'graded';
  readonly success: number;
  readonly evidenceRefs: readonly string[];
  readonly reporterId: string;
  readonly reporterConfidence: number;
  readonly groundTruth: boolean;
  readonly supersedes?: string;
}

export type JournalEntry =
  | DeliberationOpened
  | ProposalEmitted
  | RoundEvent
  | DeliberationClosed
  | OutcomeObserved;
