import { addWiredComponent as addComponent } from './test-fixtures';
import { describe, expect, it } from 'vitest';
import { doubleDebit as scenario } from '../scenarios/double-debit';
import { paydaySurge } from '../scenarios/payday-surge';
import { configureRequestHandling, removeComponent } from './architecture';
import { simulate } from './engine';
import type { ArchitectureState, RetryPolicy } from './types';

const initial = () => structuredClone(scenario.initialArchitecture);
const run = (architecture: ArchitectureState, phase?: number) => simulate({ scenario, architecture, phase });
const configured = () => configureRequestHandling(initial(), 'postgres');
const withPolicy = (architecture: ArchitectureState, policy: RetryPolicy): ArchitectureState => ({
  ...architecture, nodes: architecture.nodes.map(node => node.kind === 'users' ? { ...node, retryPolicy: policy } : node),
});

describe('Double Debit ledger and retry model', () => {
  it('exposes duplicate debits while infrastructure metrics remain healthy', () => {
    const result = run(initial());
    expect(result.telemetry).toMatchObject({ duplicateDebits: 2, incorrectBalances: 1, retryAttempts: 2, replayedRequests: 0, completionRate: 100, cost: 920, p95: 145 });
    expect(result.telemetry.apiCpu).toBeLessThan(50);
    expect(result.telemetry.dbCpu).toBeLessThan(50);
    expect(result.ledger).toMatchObject({ openingBalanceMinor: 5_000_000, expectedBalanceMinor: 4_000_000, actualBalanceMinor: 3_200_000, confirmedTransfers: 3 });
    expect(result.ledger?.postings).toHaveLength(5);
    expect(result.missionState).toBe('incident');
    expect(result.mentor.id).toBe('duplicate');
    expect(result.logs.some(log => log.level === 'ERROR' && log.message.includes('Duplicate debit'))).toBe(true);
  });

  it('shows a committed debit before its retry and never rolls it back on timeout', () => {
    expect(run(initial(), 0).ledger?.postings).toHaveLength(0);
    const committed = run(initial(), 1);
    expect(committed.ledger?.postings).toHaveLength(1);
    expect(committed.ledger?.actualBalanceMinor).toBe(4_500_000);
    expect(committed.ledger?.confirmedTransfers).toBe(0);
    expect(committed.ledger?.attempts[0]).toMatchObject({ outcome: 'committed', responseLost: true });
    expect(committed.missionState).toBe('incident');
    const retried = run(initial(), 2);
    expect(retried.telemetry.duplicateDebits).toBe(1);
    expect(retried.ledger?.postings).toHaveLength(2);
    expect(retried.ledger?.actualBalanceMinor).toBe(4_000_000);
  });

  it('replays a durable receipt on another worker without a second debit', () => {
    const result = run(configured());
    const attempts = result.ledger?.attempts ?? [];
    expect(result.telemetry).toMatchObject({ duplicateDebits: 0, incorrectBalances: 0, replayedRequests: 2, completionRate: 100, p95: 148, cost: 920 });
    expect(result.ledger?.postings).toHaveLength(3);
    expect(result.ledger?.records).toHaveLength(3);
    expect(attempts[1].response).toEqual(attempts[0].response);
    expect(attempts[1].lookup).toBe('hit');
    expect(attempts[4].restartWorker).toBe(true);
    expect(attempts[4].response).toEqual(attempts[3].response);
    expect(result.ledger?.actualBalanceMinor).toBe(4_000_000);
    expect(attempts[0].apiId).not.toBe(attempts[1].apiId);
    expect(attempts[1]).toMatchObject({ outcome: 'replayed', receiptId: attempts[0].receiptId, key: attempts[0].key, amountMinor: 0 });
    expect(attempts[4]).toMatchObject({ outcome: 'replayed', receiptId: attempts[3].receiptId, amountMinor: 0 });
    expect(new Set(result.ledger?.postings.map(posting => posting.key)).size).toBe(3);
    expect(result.objectives.every(objective => objective.passed)).toBe(true);
    expect(result.missionState).toBe('stable');
    expect(result.mentor.id).toBe('success');
  });

  it('does not treat stopping retries as recovery', () => {
    const result = run(withPolicy(initial(), { enabled: false, keyStrategy: 'same-key' }));
    expect(result.telemetry).toMatchObject({ duplicateDebits: 0, incorrectBalances: 0, completionRate: 33.33, retryAttempts: 0 });
    expect(result.ledger?.postings).toHaveLength(3);
    expect(result.ledger?.confirmedTransfers).toBe(1);
    expect(result.missionState).toBe('incident');
    expect(result.mentor.id).toBe('unconfirmed');
  });

  it('cannot deduplicate new keys generated for the same transfer', () => {
    const result = run(withPolicy(configured(), { enabled: true, keyStrategy: 'new-key' }));
    expect(result.telemetry).toMatchObject({ duplicateDebits: 2, incorrectBalances: 1, replayedRequests: 0 });
    expect(result.ledger?.attempts[1].key).not.toBe(result.ledger?.attempts[0].key);
    expect(result.missionState).toBe('incident');
    expect(result.mentor.id).toBe('newKey');
  });

  it('extra API capacity does not fix the correctness incident', () => {
    const result = run(addComponent(addComponent(initial(), 'api-medium'), 'api-medium'));
    expect(result.telemetry.apiCpu).toBeLessThan(run(initial()).telemetry.apiCpu);
    expect(result.telemetry.duplicateDebits).toBe(2);
    expect(result.missionState).toBe('incident');
  });

  it('sending a key without server-side lookup still creates duplicate debits', () => {
    const result = run(initial());
    expect(result.ledger?.attempts[0].key).toBe(result.ledger?.attempts[1].key);
    expect(result.ledger?.attempts.every(attempt => attempt.lookup === 'skipped')).toBe(true);
    expect(result.telemetry.duplicateDebits).toBe(2);
    expect(result.ledger?.records).toEqual([]);
  });

  it('missing headers cannot replay a stored transfer', () => {
    const result = run(withPolicy(configured(), { enabled: true, keyStrategy: 'none' }));
    expect(result.telemetry.duplicateDebits).toBe(2);
    expect(result.ledger?.attempts.every(attempt => attempt.key === null)).toBe(true);
    expect(result.ledger?.records).toEqual([]);
    expect(result.mentor.id).toBe('missingKey');
  });

  it('worker-local memory cannot share responses across API workers', () => {
    const result = run(configureRequestHandling(initial(), 'worker-memory'));
    expect(result.ledger?.attempts[0].apiId).not.toBe(result.ledger?.attempts[1].apiId);
    expect(result.ledger?.attempts[1].lookup).toBe('miss');
    expect(result.telemetry.duplicateDebits).toBe(2);
    expect(result.mentor.id).toBe('workerMemory');
  });

  it('a worker restart exposes local-memory loss even with only one worker', () => {
    const architecture = initial();
    architecture.edges = architecture.edges.filter(edge => edge.target !== 'api-2');
    const local = run(configureRequestHandling(architecture, 'worker-memory'));
    expect(local.ledger?.attempts[1].outcome).toBe('replayed');
    expect(local.ledger?.attempts[4]).toMatchObject({ restartWorker: true, lookup: 'miss', outcome: 'committed' });
    expect(local.telemetry.duplicateDebits).toBe(1);
    expect(local.missionState).toBe('incident');
    const shared = run(configureRequestHandling(architecture, 'postgres'));
    expect(shared.ledger?.attempts[4]).toMatchObject({ restartWorker: true, lookup: 'hit', outcome: 'replayed' });
    expect(shared.missionState).toBe('stable');
  });

  it('Redis remains usable for write-through routing, adds cost, and does not deduplicate', () => {
    const architecture = addComponent(initial(), 'redis');
    const result = run(architecture);
    expect(result.telemetry).toMatchObject({ cost: 1100, cacheHitRate: 0, duplicateDebits: 2, completionRate: 100 });
    expect(result.mentor.id).toBe('cacheOnly');
    expect(result.nodes['redis-1']).toMatchObject({ health: 'healthy', cacheHitRate: 0, detail: 'Writes pass through' });
    expect(run(configureRequestHandling(architecture, 'postgres')).missionState).toBe('stable');
    architecture.edges = architecture.edges.filter(edge => edge.source !== 'redis-1');
    const broken = run(configureRequestHandling(architecture, 'postgres'));
    expect(broken.missionState).toBe('incident');
    expect(broken.mentor.id).toBe('disconnected');
    expect(broken.telemetry.cost).toBe(1100);
  });

  it.each(['users-lb', 'api-1-db', 'api-2-db'])('broken %s path fails completion instead of winning with zero duplicates', edgeId => {
    const architecture = configured();
    architecture.edges = architecture.edges.filter(edge => edge.id !== edgeId);
    const result = run(architecture);
    expect(result.missionState).toBe('incident');
    expect(result.ledger?.confirmedTransfers).toBeLessThan(3);
    expect(result.mentor.id).toBe('disconnected');
  });

  it('rejects a caller key reused with different transfer parameters', () => {
    const conflicting = structuredClone(scenario);
    if (!conflicting.transfers) throw new Error('Transfer fixture required');
    conflicting.transfers.intents[1].key = conflicting.transfers.intents[0].key;
    const result = simulate({ scenario: conflicting, architecture: configured() });
    expect(result.ledger?.attempts[2]).toMatchObject({ outcome: 'conflict', amountMinor: 0, receiptId: null });
    expect(result.ledger?.postings).toHaveLength(2);
    expect(result.telemetry.duplicateDebits).toBe(0);
    expect(result.missionState).toBe('incident');
    expect(result.mentor.id).toBe('conflict');
  });

  it('is deterministic, starts with a fresh ledger, and never mutates inputs', () => {
    const architecture = configured();
    const before = JSON.stringify({ scenario, architecture });
    const result = run(architecture);
    expect(run(architecture)).toEqual(result);
    expect(JSON.stringify({ scenario, architecture })).toBe(before);
    expect(run(initial()).telemetry.duplicateDebits).toBe(2);
    for (const value of Object.values(result.telemetry)) expect(Number.isFinite(value)).toBe(true);
    expect(result.ledger?.postings.reduce((balance, posting) => balance - posting.amountMinor, 5_000_000)).toBe(result.ledger?.actualBalanceMinor);
  });

  it('still checks budget and charges provisioned but unused compute', () => {
    let architecture = configured();
    for (let i = 0; i < 5; i++) architecture = addComponent(architecture, 'api-medium');
    architecture.edges = architecture.edges.filter(edge => !['api-3', 'api-4', 'api-5', 'api-6', 'api-7'].includes(edge.target));
    const result = run(architecture);
    expect(result.telemetry).toMatchObject({ cost: 1520, duplicateDebits: 0, completionRate: 100 });
    expect(result.missionState).toBe('incident');
    expect(result.mentor.id).toBe('budget');
    expect(architecture.nodes).toHaveLength(10);
  });

  it('keeps the same infrastructure catalog in both missions and preserves application settings through graph edits', () => {
    for (const definition of [scenario, paydaySurge]) {
      const original = definition.initialArchitecture;
      const cached = addComponent(original, 'redis');
      expect(cached.nodes.some(node => node.kind === 'redis')).toBe(true);
      expect(addComponent(original, 'queue').nodes.some(node => node.kind === 'queue')).toBe(true);
      expect(addComponent(original, 'cdc')).toBe(original);
    }
    const original = initial();
    const solution = configureRequestHandling(original, 'postgres');
    expect(solution.nodes).toBe(original.nodes);
    expect(solution.edges).toBe(original.edges);
    const expanded = addComponent(addComponent(solution, 'api-small'), 'redis');
    expect(expanded.requestHandling).toBe('postgres');
    expect(run(expanded).missionState).toBe('stable');
    const removed = removeComponent(expanded, 'redis-1');
    expect(removed.requestHandling).toBe('postgres');
    expect(run(removed).missionState).toBe('incident');
    expect(run(removed).mentor.id).toBe('disconnected');
  });
});
