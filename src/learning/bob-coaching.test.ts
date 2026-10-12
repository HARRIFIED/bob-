import { addWiredComponent as addComponent } from '../simulation/test-fixtures';
import { describe, expect, it } from 'vitest';
import { paydaySurge as scenario } from '../scenarios/payday-surge';
import { configureRequestHandling } from '../simulation/architecture';
import { simulate } from '../simulation/engine';
import { compareRuns, getBobNote } from './bob-coaching';
import { doubleDebit } from '../scenarios/double-debit';

const architecture = scenario.initialArchitecture;
const baseline = simulate({ scenario, architecture });
const cached = addComponent(architecture, 'redis');
const solution = addComponent(addComponent(cached, 'api-medium'), 'api-medium');
const context = { scenario, architecture, result: baseline, running: false, stale: false, phase: -1, revision: 0 };

describe('Bob’s evidence-based coaching', () => {
  it('does not celebrate a healthy low-load sample before the peak run completes', () => {
    const lowLoad = simulate({ scenario, architecture, traffic: 1200 });
    expect(lowLoad.missionState).toBe('stable');
    const note = getBobNote({ ...context, result: lowLoad, running: true, phase: 0 });
    expect(note.mood).toBe('working');
    expect(note.action).toBe('Metrics');
    expect(note.hint).toContain('Wait for peak traffic');
  });

  it('replaces old success advice after an unmeasured edit', () => {
    const result = simulate({ scenario, architecture: solution });
    expect(result.missionState).toBe('stable');
    const note = getBobNote({ ...context, architecture: solution, result, stale: true, revision: 1 });
    expect(note.mood).toBe('thinking');
    expect(note.action).toBe('run');
  });

  it('follows the bottleneck from database to compute, then recognizes success', () => {
    expect(getBobNote(context).action).toBe('Traces');
    expect(getBobNote({ ...context, architecture: cached, result: simulate({ scenario, architecture: cached }) }).action).toBe('Metrics');
    expect(getBobNote({ ...context, architecture: solution, result: simulate({ scenario, architecture: solution }) }).mood).toBe('celebrating');
  });

  it('does not celebrate a fast but over-budget result', () => {
    const expensive = addComponent(addComponent(solution, 'api-medium'), 'api-medium');
    expect(getBobNote({ ...context, architecture: expensive, result: simulate({ scenario, architecture: expensive }) }).action).toBe('Cost');
  });

  it('compares actual runs with direction and percentage-point units', () => {
    const result = simulate({ scenario, architecture: solution });
    expect(compareRuns(result, baseline)).toBe('Latency 682 ms lower; errors 13.8 percentage points lower vs. your last run. 5/5 requirements passed.');
    expect(compareRuns(baseline, result)).toContain('682 ms higher; errors 13.8 percentage points higher');
    expect(compareRuns(result, result)).toContain('Latency unchanged; errors unchanged');
    expect(compareRuns(baseline, null)).toContain('Baseline captured');
  });
});

describe('Bob follows ledger evidence in Double Debit', () => {
  const architecture = doubleDebit.initialArchitecture;
  const guarded = configureRequestHandling(architecture, 'postgres');
  const baseline = simulate({ scenario: doubleDebit, architecture });
  const success = simulate({ scenario: doubleDebit, architecture: guarded });
  const context = { scenario: doubleDebit, architecture, result: baseline, running: false, stale: false, phase: -1, revision: 0 };

  it('points to the ledger even when processing is healthy', () => {
    const note = getBobNote(context);
    expect(note.mood).toBe('worried');
    expect(note.action).toBe('Ledger');
    expect(note.text).toContain('already committed');
  });

  it('waits for the entire retry sequence before celebrating', () => {
    const note = getBobNote({ ...context, architecture: guarded, result: success, running: true, phase: 5 });
    expect(note.mood).toBe('working');
    expect(note.action).toBe('Ledger');
    expect(note.hint).toContain('Wait for both retries');
  });

  it('requires a new run after a retry-policy or graph edit', () => {
    expect(getBobNote({ ...context, architecture: guarded, result: success }).mood).toBe('celebrating');
    const note = getBobNote({ ...context, architecture: guarded, result: success, stale: true, revision: 1 });
    expect(note.mood).toBe('thinking');
    expect(note.action).toBe('run');
  });

  it('compares correctness and confirmations rather than celebrating a latency change', () => {
    expect(compareRuns(success, baseline)).toBe('2 fewer duplicate debits vs. your last run. 3/3 transfers confirmed. 5/5 requirements passed.');
    expect(compareRuns(baseline, success)).toContain('2 more duplicate debits');
    expect(compareRuns(success, success)).toContain('Duplicate debits unchanged');
  });
});
