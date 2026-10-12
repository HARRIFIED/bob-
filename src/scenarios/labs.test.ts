import { describe, expect, it } from 'vitest';
import { componentGuides, guideKeyFor } from '../learning/component-guides';
import { addComponent, configureNode, connect } from '../simulation/architecture';
import { simulate } from '../simulation/engine';
import type { ArchitectureState, ComponentKind } from '../simulation/types';
import { labById, labs } from './labs';

const lab = (id: string) => {
  const found = labById(id);
  if (!found) throw new Error(`Missing lab ${id}`);
  return found;
};
const run = (id: string, architecture: ArchitectureState) => simulate({ scenario: lab(id).scenario, architecture });
const start = (id: string) => structuredClone(lab(id).scenario.initialArchitecture);
const apiIds = (architecture: ArchitectureState) => architecture.nodes.filter(node => node.kind.startsWith('api-')).map(node => node.id);
/** Adds a component and wires it through the same guided connections learners use. */
function add(architecture: ArchitectureState, kind: ComponentKind, from: string[], to: string[]) {
  let next = addComponent(architecture, kind);
  const id = next.nodes.at(-1)?.id ?? '';
  for (const source of from) next = connect(next, source, id);
  for (const target of to) next = connect(next, id, target);
  return { architecture: next, id };
}

describe('Component Labs', () => {
  it('every lab starts unsolved, so the learner has something to fix', () => {
    for (const item of labs) {
      expect(simulate({ scenario: item.scenario, architecture: item.scenario.initialArchitecture }).missionState, item.id).toBe('incident');
    }
  });
  it('every lab component has a Field Guide and lab ids are unique', () => {
    expect(new Set(labs.map(item => item.id)).size).toBe(labs.length);
    for (const item of labs) expect(componentGuides[guideKeyFor(item.component)], item.id).toBeDefined();
  });
  it('scaling out and N+1 redundancy pass within budget', () => {
    expect(run('scale-out', add(start('scale-out'), 'api-medium', ['lb'], ['db']).architecture).missionState).toBe('stable');
    expect(run('survive-failure', add(start('survive-failure'), 'api-small', ['lb'], ['db']).architecture).missionState).toBe('stable');
  });
  it('caching shields the database where more compute does not', () => {
    const base = start('redis-shield');
    const cache = add(base, 'redis', apiIds(base), ['db']);
    expect(run('redis-shield', cache.architecture).missionState).toBe('stable');
    const compute = add(add(base, 'api-medium', ['lb'], ['db']).architecture, 'api-medium', ['lb'], ['db']).architecture;
    expect(run('redis-shield', compute).objectives.find(o => o.id === 'dbCpu')?.passed).toBe(false);
  });
  it('right-sizing finds the cache that is neither too small nor too expensive', () => {
    const size = (memoryGb: number) => run('redis-sizing', configureNode(start('redis-sizing'), 'redis', { memoryGb }));
    expect(size(2).missionState).toBe('stable');
    expect(size(1).objectives.find(o => o.id === 'dbCpu')?.passed).toBe(false);
    expect(size(4).objectives.find(o => o.id === 'cost')?.passed).toBe(false);
  });
  it('invalidation fixes freshness; a short TTL alone does not', () => {
    expect(run('redis-freshness', configureNode(start('redis-freshness'), 'redis', { writePolicy: 'invalidate' })).missionState).toBe('stable');
    const shortTtl = run('redis-freshness', configureNode(start('redis-freshness'), 'redis', { ttlSeconds: 10 }));
    expect(shortTtl.missionState).toBe('incident');
    expect(shortTtl.telemetry.incorrectBalances).toBeGreaterThan(0);
  });
  it('a cold cache needs read headroom behind it, not more API instances', () => {
    const base = start('redis-cold-start');
    const one = add(base, 'read-replica', ['redis', 'db'], []);
    const two = add(one.architecture, 'read-replica', ['redis', 'db'], []);
    expect(run('redis-cold-start', two.architecture).missionState).toBe('stable');
    expect(run('redis-cold-start', add(base, 'mysql', ['redis'], []).architecture).missionState).toBe('stable');
    expect(run('redis-cold-start', add(base, 'api-medium', ['lb'], ['redis']).architecture).missionState).toBe('incident');
  });
  it('a read replica offloads the primary, and read-your-writes removes stale balances', () => {
    const base = start('replica-offload');
    const replica = add(base, 'read-replica', ['db', ...apiIds(base)], []);
    const offloaded = run('replica-offload', replica.architecture);
    expect(offloaded.missionState).toBe('stable');
    expect(offloaded.telemetry.staleReads).toBeGreaterThan(0);
    expect(run('replica-read-your-writes', start('replica-read-your-writes')).telemetry.incorrectBalances).toBeGreaterThan(0);
    expect(run('replica-read-your-writes', configureNode(start('replica-read-your-writes'), 'replica', { readYourWrites: true })).missionState).toBe('stable');
  });
  it('a queue spreads writes over time, and too many workers overload the database again', () => {
    const base = start('queue-absorb');
    const queue = add(base, 'queue', apiIds(base), []);
    const oneWorker = add(queue.architecture, 'worker', [queue.id], ['db']);
    expect(run('queue-absorb', oneWorker.architecture).missionState).toBe('stable');
    const twoWorkers = add(oneWorker.architecture, 'worker', [queue.id], ['db']);
    expect(run('queue-absorb', twoWorkers.architecture).objectives.find(o => o.id === 'dbCpu')?.passed).toBe(false);
  });
  it('more Kafka partitions put the idle consumers to work', () => {
    expect(run('kafka-partitions', configureNode(start('kafka-partitions'), 'kafka', { partitions: 3 })).missionState).toBe('stable');
  });
});
