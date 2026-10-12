import { describe, expect, it } from 'vitest';
import { configureNode } from '../simulation/architecture';
import { simulate } from '../simulation/engine';
import { defaultSandboxSettings, sandboxScenario } from '../simulation/sandbox';
import type { ArchitectureState, ComponentKind } from '../simulation/types';
import { challenges } from './challenges';
import { paydaySurge } from './payday-surge';

const scenario = (challenge: string) => sandboxScenario({ ...defaultSandboxSettings, challenge });
type Spec = [id: string, kind: ComponentKind];
const graph = (nodes: Spec[], edges: [string, string][]): ArchitectureState => ({
  nodes: nodes.map(([id, kind], index) => ({ id, kind, label: id, position: { x: index * 100, y: 0 }, added: true })),
  edges: edges.map(([source, target]) => ({ id: `${source}-${target}`, source, target })),
});
const apis = (count: number, kind: ComponentKind = 'api-medium') => Array.from({ length: count }, (_, index): Spec => [`api-${index + 1}`, kind]);

describe('Sandbox design challenges', () => {
  it('replace the free-form workload and goals, and the starting board does not pass', () => {
    for (const challenge of challenges) {
      const definition = scenario(challenge.id);
      expect(definition.trafficProfile).toMatchObject({ peak: challenge.peak, readFraction: challenge.readFraction });
      expect(definition.objectives).toBe(challenge.objectives);
      expect(simulate({ scenario: definition, architecture: paydaySurge.initialArchitecture }).missionState, challenge.id).toBe('incident');
    }
  });
  it('Payday on a shoestring: a mixed fleet with a cache fits $1,300', () => {
    const fleet = [...apis(3), ['api-4', 'api-small'] as Spec];
    const design = graph([['users', 'users'], ['lb', 'load-balancer'], ...fleet, ['redis', 'redis'], ['db', 'postgres']],
      [['users', 'lb'], ...fleet.flatMap(([id]): [string, string][] => [['lb', id], [id, 'redis']]), ['redis', 'db']]);
    const result = simulate({ scenario: scenario('cost-cutter'), architecture: design });
    expect(result.missionState).toBe('stable');
    expect(result.telemetry.cost).toBe(1300);
  });
  it('URL shortener: two long-TTL caches absorb popular links within $3,000', () => {
    const fleet = apis(10);
    const design = graph([['users', 'users'], ['lb', 'load-balancer'], ...fleet, ['r1', 'redis'], ['r2', 'redis'], ['db', 'postgres']], [
      ['users', 'lb'], ...fleet.flatMap(([id]): [string, string][] => [['lb', id], [id, 'r1'], [id, 'r2'], [id, 'db']]), ['r1', 'db'], ['r2', 'db'],
    ]);
    const warm = configureNode(configureNode(design, 'r1', { ttlSeconds: 3600 }), 'r2', { ttlSeconds: 3600 });
    expect(simulate({ scenario: scenario('url-shortener'), architecture: warm }).missionState).toBe('stable');
    expect(simulate({ scenario: scenario('url-shortener'), architecture: design }).objectives.find(o => o.id === 'dbCpu')?.passed).toBe(false);
  });
  it('Flash sale: a queue with a throttled worker pool protects the database', () => {
    const fleet = apis(3);
    const design = (workers: number) => graph(
      [['users', 'users'], ['lb', 'load-balancer'], ...fleet, ['redis', 'redis'], ['db', 'postgres'], ['q', 'queue'], ...Array.from({ length: workers }, (_, i): Spec => [`w${i}`, 'worker'])],
      [
        ['users', 'lb'], ...fleet.flatMap(([id]): [string, string][] => [['lb', id], [id, 'redis'], [id, 'q']]), ['redis', 'db'],
        ...Array.from({ length: workers }, (_, i): [string, string][] => [['q', `w${i}`], [`w${i}`, 'db']]).flat(),
      ],
    );
    expect(simulate({ scenario: scenario('flash-sale'), architecture: design(2) }).missionState).toBe('stable');
    expect(simulate({ scenario: scenario('flash-sale'), architecture: design(4) }).objectives.find(o => o.id === 'dbCpu')?.passed).toBe(false);
    expect(simulate({ scenario: scenario('flash-sale'), architecture: design(1) }).objectives.find(o => o.id === 'asyncLag')?.passed).toBe(false);
  });
});
