import { addWiredComponent as addComponent } from './test-fixtures';
import { describe, expect, it } from 'vitest';
import { paydaySurge as scenario } from '../scenarios/payday-surge';
import { canConnect, connect, removeComponent } from './architecture';
import { monthlyCost } from './cost';
import { simulate } from './engine';
import { objectivePasses } from './formulas';
import type { ArchitectureState } from './types';

const initial = () => structuredClone(scenario.initialArchitecture);
const run = (architecture: ArchitectureState) => simulate({ scenario, architecture });
const solved = () => addComponent(addComponent(addComponent(initial(), 'api-medium'), 'api-medium'), 'redis');

describe('Payday Surge learning model', () => {
  it('reproduces the incident with a dominant database dependency', () => {
    const result = run(initial());
    expect(result.telemetry).toMatchObject({ cost: 920, traffic: 12000, p95: 827, dbCpu: 97, dbConnections: 100, errorRate: 13.84 });
    expect(result.missionState).toBe('incident');
    expect(result.trace.find(s => s.name === 'PostgreSQL')!.duration).toBeGreaterThan(result.trace.find(s => s.name === 'API')!.duration);
    expect(result.logs.some(l => l.message.includes('connection timeout'))).toBe(true);
  });
  it('is deterministic and does not mutate scenario or architecture input', () => {
    const a = initial();
    const before = JSON.stringify({ scenario, a });
    expect(run(a)).toEqual(run(a));
    expect(JSON.stringify({ scenario, a })).toBe(before);
  });
  it('adding only compute cannot fix the database', () => {
    let a = initial();
    for (let i = 0; i < 6; i++) a = addComponent(a, 'api-medium');
    const result = run(a);
    expect(result.telemetry.apiCpu).toBeLessThan(run(initial()).telemetry.apiCpu);
    expect(result.telemetry.dbCpu).toBe(97);
    expect(result.telemetry.p95).toBeGreaterThan(300);
    expect(result.missionState).toBe('incident');
    expect(result.mentor.id).toBe('computeOnly');
  });
  it('Redis alone fixes database pressure but leaves insufficient compute', () => {
    const result = run(addComponent(initial(), 'redis'));
    expect(result.telemetry.cacheHitRate).toBe(82);
    expect(result.telemetry.dbCpu).toBeLessThan(75);
    expect(result.telemetry.dbConnections).toBeLessThan(85);
    expect(result.telemetry.apiCpu).toBe(98);
    expect(result.missionState).toBe('incident');
    expect(result.mentor.id).toBe('compute');
  });
  it('combined API scaling and caching meets all five objectives within budget', () => {
    const result = run(solved());
    expect(result.telemetry).toMatchObject({ p95: 145, errorRate: 0.04, cost: 1340, incorrectBalances: 0, availability: 99.96 });
    expect(result.objectives).toHaveLength(5);
    expect(result.objectives.every(o => o.passed)).toBe(true);
    expect(result.missionState).toBe('stable');
  });
  it('evaluates metrics, allowing a different valid mix of instance sizes', () => {
    const a = solved();
    a.nodes = a.nodes.map(n => n.id === 'api-3' || n.id === 'api-4' ? { ...n, kind: 'api-small' } : n);
    const result = run(a);
    expect(result.missionState).toBe('stable');
    expect(result.telemetry.cost).toBe(1260);
  });
  it('a technically healthy solution still fails over budget', () => {
    const a = addComponent(addComponent(solved(), 'api-medium'), 'api-medium');
    const result = run(a);
    expect(result.telemetry.p95).toBeLessThan(300);
    expect(result.telemetry.cost).toBe(1580);
    expect(result.objectives.find(o => o.id === 'cost')?.passed).toBe(false);
    expect(result.missionState).toBe('incident');
    expect(result.mentor.id).toBe('budget');
  });
  it('a cache that is not connected cannot absorb reads', () => {
    const a = solved();
    a.edges = a.edges.filter(e => !e.source.startsWith('redis') && !e.target.startsWith('redis'));
    for (const api of a.nodes.filter(n => n.kind.startsWith('api'))) a.edges.push({ id: `${api.id}-db`, source: api.id, target: 'db' });
    const result = run(a);
    expect(result.telemetry.cacheHitRate).toBe(0);
    expect(result.telemetry.dbCpu).toBe(97);
    expect(result.missionState).toBe('incident');
    expect(result.telemetry.cost).toBe(1340);
  });
  it('cache coverage follows actual API connections', () => {
    let a = addComponent(initial(), 'redis');
    a.edges = a.edges.filter(e => !(e.source === 'api-2' && e.target.startsWith('redis')));
    a = connect(a, 'api-2', 'db');
    expect(run(a).telemetry.cacheHitRate).toBe(41);
  });
  it('broken request paths cause explicit failures', () => {
    const a = solved();
    a.edges = a.edges.filter(e => e.id !== 'users-lb');
    const result = run(a);
    expect(result.telemetry.errorRate).toBe(100);
    expect(result.nodes['api-1'].health).toBe('failed');
    expect(result.mentor.id).toBe('disconnected');
    expect(result.missionState).toBe('incident');
  });
  it('one disconnected API cannot silently improve the result', () => {
    const a = solved();
    a.edges = a.edges.filter(e => e.source !== 'api-1');
    expect(run(a).telemetry.errorRate).toBeGreaterThan(20);
  });
  it('normal traffic is healthy while peak traffic fails on the same architecture', () => {
    const low = simulate({ scenario, architecture: initial(), traffic: 1200 });
    expect(low.missionState).toBe('stable');
    expect(run(initial()).missionState).toBe('incident');
  });
  it('traces reconcile exactly to latency and results contain no non-finite numbers', () => {
    for (const a of [initial(), solved(), addComponent(initial(), 'redis')]) {
      const result = run(a);
      expect(result.trace.reduce((sum, span) => sum + span.duration, 0)).toBe(result.telemetry.p95);
      expect(Object.values(result.telemetry).every(Number.isFinite)).toBe(true);
    }
  });
  it('applies strict latency/error thresholds and inclusive budget/availability thresholds', () => {
    for (const objective of scenario.objectives) {
      expect(objectivePasses(objective, objective.target)).toBe(objective.comparison !== 'lt');
    }
  });
});
describe('architecture editing', () => {
  it('validates supported connections, duplicate links, and cycles', () => {
    const a = initial();
    expect(canConnect(a, 'db', 'api-1')).toBe(false);
    expect(canConnect(a, 'users', 'db')).toBe(false);
    expect(canConnect(a, 'lb', 'api-1')).toBe(false);
    expect(canConnect(a, 'missing', 'db')).toBe(false);
  });
  it('preserves starting nodes and leaves broken paths visible when removing Redis', () => {
    const a = addComponent(initial(), 'redis');
    expect(removeComponent(a, 'db')).toBe(a);
    const next = removeComponent(a, 'redis-1');
    expect(next.edges.some(e => e.source.startsWith('redis') || e.target.startsWith('redis'))).toBe(false);
    expect(run(next).telemetry.errorRate).toBe(100);
  });
  it('adds API instances before or after Redis with valid routing', () => {
    const a = addComponent(addComponent(addComponent(initial(), 'redis'), 'api-medium'), 'api-medium');
    expect(run(a).missionState).toBe('stable');
    expect(run(a).disconnected).toHaveLength(0);
  });
  it('removes added nodes and their cost; prevents duplicate caches and preview components', () => {
    const a = solved();
    const next = removeComponent(a, 'api-3');
    expect(monthlyCost(next)).toBe(1220);
    expect(next.edges.some(e => e.source === 'api-3' || e.target === 'api-3')).toBe(false);
    expect(addComponent(a, 'redis')).toBe(a);
    expect(addComponent(a, 'queue')).toBe(a);
  });
});
