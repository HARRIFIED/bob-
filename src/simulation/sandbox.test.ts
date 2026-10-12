import { describe, expect, it } from 'vitest';
import { paydaySurge } from '../scenarios/payday-surge';
import { addComponent, connect, removeComponent } from './architecture';
import { simulate } from './engine';
import { defaultSandboxSettings, parseSandboxProject, sandboxRunBlocker, sandboxScenario } from './sandbox';
import type { SandboxProject } from './sandbox';

const initial = () => structuredClone(paydaySurge.initialArchitecture);
const project = (): SandboxProject => ({ version: 1, name: 'My experiment', settings: { ...defaultSandboxSettings }, architecture: initial() });
describe('manual diagram editing', () => {
  it('adds at the requested point without wiring, rearranging, or mutating existing nodes', () => {
    const a = initial();
    const b = addComponent(a, 'api-medium', { x: -100, y: 320 });
    expect(b.edges).toBe(a.edges);
    expect(b.nodes.slice(0, -1)).toEqual(a.nodes);
    expect(b.nodes.at(-1)?.position).toEqual({ x: -100, y: 320 });
    expect(simulate({ scenario: paydaySurge, architecture: b }).disconnected).toContain('API Server 03');
  });
  it('removing a component deletes only incident edges and preserves every other position', () => {
    let a = addComponent(initial(), 'redis');
    a = connect(a, 'api-1', 'redis-1');
    a = connect(a, 'redis-1', 'db');
    const b = removeComponent(a, 'redis-1');
    expect(b).toEqual(initial());
    expect(removeComponent(a, 'db')).toBe(a);
    expect(removeComponent(a, 'db', true).nodes.some(n => n.id === 'db')).toBe(false);
  });
  it('allows design previews and arbitrary links only as an explicitly non-runnable sandbox diagram', () => {
    const a = initial();
    expect(addComponent(a, 'cdc')).toBe(a);
    const diagram = connect(addComponent(a, 'cdc', undefined, true), 'db', 'cdc-1', true);
    expect(diagram.edges.at(-1)).toMatchObject({ source: 'db', target: 'cdc-1' });
    expect(sandboxRunBlocker(diagram)).toContain('Change Data Capture');
    expect(sandboxRunBlocker(connect(a, 'db', 'users', true))).toContain('routes outside');
    expect(sandboxRunBlocker(addComponent(a, 'postgres', undefined, true))).toContain('one client');
    expect(sandboxRunBlocker(a)).toBeNull();
  });
});
describe('sandbox experiments', () => {
  it('changes traffic and read mix deterministically without modifying mission defaults', () => {
    const scenario = sandboxScenario({ ...defaultSandboxSettings, peak: 2500, readFraction: 0.1 });
    const a = initial();
    const result = simulate({ scenario, architecture: a });
    expect(result).toEqual(simulate({ scenario, architecture: a }));
    expect(result.telemetry.traffic).toBe(2500);
    expect(result.objectives).toEqual([]);
    expect(paydaySurge.trafficProfile).toMatchObject({ peak: 12000, readFraction: 0.9 });
    expect(sandboxScenario({ ...defaultSandboxSettings, targets: true, budget: 1000 }).objectives.find(o => o.id === 'cost')?.target).toBe(1000);
  });
  it('disabling lost responses removes retry deliveries and duplicate effects', () => {
    const scenario = sandboxScenario({ ...defaultSandboxSettings, workload: 'transfers', lostResponses: false, peak: 1200 });
    const result = simulate({ scenario, architecture: initial() });
    expect(result.telemetry).toMatchObject({ duplicateDebits: 0, retryAttempts: 0, completionRate: 100 });
    expect(result.ledger?.attempts).toHaveLength(3);
    expect(result.ledger?.attempts.some(a => a.restartWorker)).toBe(false);
  });
  it('worker restart switch changes local-memory correctness with one worker', () => {
    const a = initial();
    a.requestHandling = 'worker-memory';
    a.edges = a.edges.filter(e => e.target !== 'api-2');
    const settings = { ...defaultSandboxSettings, workload: 'transfers' as const, peak: 1200 };
    expect(simulate({ scenario: sandboxScenario(settings), architecture: a }).telemetry.duplicateDebits).toBe(1);
    expect(simulate({ scenario: sandboxScenario({ ...settings, restartWorker: false }), architecture: a }).telemetry.duplicateDebits).toBe(0);
  });
});
describe('sandbox file validation', () => {
  it('round-trips diagrams and settings while discarding imported results and unknown fields', () => {
    const p = project();
    p.architecture = addComponent(p.architecture, 'mysql', { x: 0, y: 200 }, true);
    const restored = parseSandboxProject(JSON.stringify({ ...p, result: { missionState: 'stable' } }));
    expect(restored.settings).toEqual(p.settings);
    expect(restored.architecture.nodes.map(n => n.position)).toEqual(p.architecture.nodes.map(n => n.position));
    expect(restored).not.toHaveProperty('result');
    expect(sandboxRunBlocker(restored.architecture)).toContain('MySQL');
  });
  it('rejects malformed values, duplicate ids, dangling edges, unknown kinds and oversized inputs', () => {
    const cases: unknown[] = [null, {}, { ...project(), version: 2 }];
    const unknown = project(); unknown.architecture.nodes[0].kind = 'invalid' as never; cases.push(unknown);
    const dangling = project(); dangling.architecture.edges[0].target = 'missing'; cases.push(dangling);
    const duplicate = project(); duplicate.architecture.nodes.push(duplicate.architecture.nodes[0]); cases.push(duplicate);
    const invalidLoad = project(); invalidLoad.settings.peak = -1; cases.push(invalidLoad);
    for (const value of cases) expect(() => parseSandboxProject(JSON.stringify(value))).toThrow();
    expect(() => parseSandboxProject(' '.repeat(500001))).toThrow();
  });
});
