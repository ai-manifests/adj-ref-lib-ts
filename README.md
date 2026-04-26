# adj-manifest

A TypeScript reference implementation of the **Agent Deliberation Journal (ADJ)** specification — the append-only journal format that records every step of a multi-agent deliberation: when it opened, what proposals were emitted, what falsifications happened, when it closed, and what outcome was eventually observed.

This library is one of several reference implementations ([C#](https://github.com/ai-manifests/adj-ref-lib-csharp), [Python](https://github.com/ai-manifests/adj-ref-lib-py)) of the same spec. The spec itself is at [adp-manifest.dev](https://adp-manifest.dev) and is the source of truth; this library implements what the spec says.

Zero runtime dependencies. Pure TypeScript, ESM.

## Install

```bash
npm install @ai-manifests/adj-manifest
```

## Quick example

```ts
import {
  InMemoryJournalStore,
  computeCalibration,
  type DeliberationOpened,
  type ProposalEmitted,
} from '@ai-manifests/adj-manifest';

const store = new InMemoryJournalStore();

store.append({
  entryType: 'deliberation_opened',
  entryId: 'adj_01HMX',
  deliberationId: 'dlb_42',
  timestamp: new Date().toISOString(),
  priorEntryHash: null,
  action: { kind: 'code.merge', tier: 'auto', blastRadius: 'team-scope' },
  config: { minAgents: 3, timeoutSeconds: 300 },
} satisfies DeliberationOpened);

// ... append proposals, round events, deliberation close, outcome ...

const score = computeCalibration(scoringPairs);
// score.value is the Brier-scored calibration score in [0, 1]
```

## API

All exports are re-exported from the package root.

### Entry types

`JournalEntry`, `DeliberationOpened`, `ProposalEmitted`, `RoundEvent`, `DeliberationClosed`, `OutcomeObserved`

### Value types

`ActionDescriptor`, `TallyRecord`, `ProposalData`, `ConditionRecord`, `DeliberationConfig`, `CalibrationScore`, `ScoringPair`, `ConditionQualityMetrics`

### Functions

- `computeCalibration(pairs)` — Brier-scored calibration score from a list of `(confidence, outcome)` pairs
- `updateCalibration(score, pair)` — fold a new observation into an existing score
- `getDefaultCalibration()` — initial score for a new agent with no history
- `computeConditionQuality(entries)` — per-condition quality metrics from a set of journal entries

### Store

- `InMemoryJournalStore` — thread-safe in-memory journal store suitable for tests and prototypes. Implements the store contract from the spec.

## Testing

```bash
npm test
```

## Spec

This library implements the Agent Deliberation Journal specification. Read the spec at [adp-manifest.dev](https://adp-manifest.dev). If the spec and this library disagree, the spec is correct and this is a bug.

## License

Apache-2.0 — see [`LICENSE`](LICENSE) for the full license text and [`NOTICE`](NOTICE) for attribution.
