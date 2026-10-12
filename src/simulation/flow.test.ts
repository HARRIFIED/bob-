import { describe, expect, it } from 'vitest';
import { paydaySurge } from '../scenarios/payday-surge';
import { configureNode, setNodeFault } from './architecture';
import { simulate } from './engine';
import type { ArchitectureState, ComponentKind, ScenarioDefinition } from './types';

type Spec = [id: string, kind: ComponentKind];
const graph = (nodes: Spec[], edges: [string, string][]): ArchitectureState => ({
  nodes: nodes.map(([id, kind], index) => ({ id, kind, label: id, position: { x: index * 100, y: 0 }, added: true })),
  edges: edges.map(([source, target]) => ({ id: `${source}-${target}`, source, target })),
});
const run = (architecture: ArchitectureState, scenario: ScenarioDefinition = paydaySurge, traffic?: number) =>
  simulate({ scenario, architecture, traffic });
const withReads = (readFraction: number): ScenarioDefinition => ({ ...paydaySurge, objectives: [], trafficProfile: { ...paydaySurge.trafficProfile, readFraction } });

const apis = ['a1', 'a2', 'a3', 'a4'];
/** Four medium APIs behind a load balancer: the documented Payday solution, wired explicitly. */
const front = (): { nodes: Spec[]; edges: [string, string][] } => ({
  nodes: [['users', 'users'], ['lb', 'load-balancer'], ...apis.map((id): Spec => [id, 'api-medium'])],
  edges: [['users', 'lb'], ...apis.map((id): [string, string] => ['lb', id])],
});
const cached = () => {
  const base = front();
  return graph([...base.nodes, ['redis', 'redis'], ['db', 'postgres']], [...base.edges, ...apis.map((id): [string, string] => [id, 'redis']), ['redis', 'db']]);
};

describe('Redis settings change measured behavior', () => {
  it('less memory than the hot data lowers the hit rate and the bill', () => {
    const small = configureNode(cached(), 'redis', { memoryGb: 1 });
    const result = run(small);
    expect(run(cached()).telemetry.cacheHitRate).toBe(82);
    expect(result.telemetry.cacheHitRate).toBe(41);
    expect(result.telemetry.cost).toBe(run(cached()).telemetry.cost - 120);
    expect(result.telemetry.dbCpu).toBeGreaterThan(run(cached()).telemetry.dbCpu);
  });
  it('a short TTL keeps fewer keys warm', () => {
    expect(run(configureNode(cached(), 'redis', { ttlSeconds: 10 })).telemetry.cacheHitRate).toBe(50);
    expect(run(configureNode(cached(), 'redis', { ttlSeconds: 3600 })).telemetry.cacheHitRate).toBe(88);
  });
  it('TTL-only expiry serves old balances; invalidate-on-write does not', () => {
    const ttlOnly = run(configureNode(cached(), 'redis', { writePolicy: 'ttl-only' }));
    expect(run(cached()).telemetry.staleReads).toBe(0);
    expect(ttlOnly.telemetry.staleReads).toBeGreaterThan(100);
    expect(ttlOnly.objectives.find(o => o.id === 'incorrectBalances')?.passed).toBe(false);
    expect(ttlOnly.mentor.id).toBe('stale');
  });
  it('a flushed cache sends the stampede to the database', () => {
    const cold = run(setNodeFault(cached(), 'redis', 'cold'));
    expect(cold.telemetry.cacheHitRate).toBeLessThan(10);
    expect(cold.telemetry.dbCpu).toBe(97);
    expect(cold.logs.some(log => log.message.includes('stampede'))).toBe(true);
  });
});

describe('read replicas', () => {
  const replicated = () => {
    const base = front();
    return graph(
      [...base.nodes, ['db', 'postgres'], ['replica', 'read-replica']],
      [...base.edges, ...apis.flatMap((id): [string, string][] => [[id, 'db'], [id, 'replica']]), ['db', 'replica']],
    );
  };
  it('take reads off the primary but lag behind it', () => {
    const base = front();
    const primaryOnly = run(graph([...base.nodes, ['db', 'postgres']], [...base.edges, ...apis.map((id): [string, string] => [id, 'db'])]));
    const result = run(replicated());
    expect(result.nodes.db.traffic).toBeLessThan(primaryOnly.nodes.db.traffic);
    expect(result.nodes.replica.traffic).toBeGreaterThan(0);
    expect(result.telemetry.replicaLag).toBeGreaterThan(20);
    expect(result.telemetry.staleReads).toBeGreaterThan(0);
  });
  it('read-your-writes routing removes stale follow-up reads by loading the primary', () => {
    const lagging = run(replicated());
    const guarded = run(configureNode(replicated(), 'replica', { readYourWrites: true }));
    expect(guarded.telemetry.staleReads).toBe(0);
    expect(guarded.nodes.db.traffic).toBeGreaterThan(lagging.nodes.db.traffic);
  });
  it('cannot serve reads without a primary to replicate from', () => {
    const architecture = replicated();
    architecture.edges = architecture.edges.filter(edge => edge.id !== 'db-replica');
    const result = run(architecture);
    expect(result.telemetry.errorRate).toBeGreaterThan(20);
    expect(result.notes.join(' ')).not.toContain('loop');
    expect(result.logs.some(log => log.message.includes('no primary to replicate from'))).toBe(true);
  });
});

describe('queues and background workers', () => {
  const queued = (kind: 'queue' | 'kafka', workers: number) => {
    const base = front();
    const workerIds = Array.from({ length: workers }, (_, index) => `w${index + 1}`);
    return graph(
      [...base.nodes, ['redis', 'redis'], ['db', 'postgres'], ['q', kind], ...workerIds.map((id): Spec => [id, 'worker'])],
      [
        ...base.edges, ...apis.flatMap((id): [string, string][] => [[id, 'redis'], [id, 'q']]), ['redis', 'db'],
        ...workerIds.flatMap((id): [string, string][] => [['q', id], [id, 'db']]),
      ],
    );
  };
  const halfWrites = withReads(0.5);
  it('acknowledge writes quickly and build a backlog when consumers fall behind', () => {
    const one = run(queued('queue', 1), halfWrites, 4000);
    expect(one.telemetry.queueBacklog).toBe(48000);
    expect(one.telemetry.asyncLag).toBeGreaterThan(30);
    expect(one.mentor.id).toBe('stale');
    const two = run(queued('queue', 2), halfWrites, 4000);
    expect(two.telemetry.queueBacklog).toBe(0);
    expect(two.telemetry.staleReads).toBeLessThan(one.telemetry.staleReads);
  });
  it('even an empty queue delays writes, so follow-up reads can be stale', () => {
    const result = run(queued('queue', 2), halfWrites, 2000);
    expect(result.telemetry.queueBacklog).toBe(0);
    expect(result.telemetry.staleReads).toBeGreaterThan(0);
  });
  it('a full RabbitMQ queue rejects publishes as errors', () => {
    const result = run(queued('queue', 1), halfWrites, 40000);
    expect(result.telemetry.errorRate).toBeGreaterThan(20);
    expect(result.logs.some(log => log.message.includes('rejecting publishes'))).toBe(true);
  });
  it('Kafka partitions cap how many consumers in a group can work', () => {
    const limited = run(queued('kafka', 3), halfWrites, 6000);
    const scaled = run(configureNode(queued('kafka', 3), 'q', { partitions: 3 }), halfWrites, 6000);
    const onePartition = run(configureNode(queued('kafka', 3), 'q', { partitions: 1 }), halfWrites, 6000);
    expect(limited.telemetry.queueBacklog).toBe(0);
    expect(scaled.telemetry.queueBacklog).toBe(0);
    expect(onePartition.telemetry.queueBacklog).toBeGreaterThan(0);
    expect(onePartition.notes.some(note => note.includes('only 1 of 3 consumers'))).toBe(true);
  });
  it('a queue without consumers never applies writes', () => {
    const architecture = queued('queue', 1);
    architecture.edges = architecture.edges.filter(edge => edge.target !== 'w1');
    const result = run(architecture, halfWrites, 2000);
    expect(result.notes.some(note => note.includes('no working consumer'))).toBe(true);
    expect(result.telemetry.asyncLag).toBe(600);
  });
});

describe('faults and redundancy', () => {
  it('the load balancer routes around one offline API', () => {
    const result = run(setNodeFault(cached(), 'a1', 'down'));
    expect(result.nodes.a1).toMatchObject({ traffic: 0, health: 'failed', detail: 'Offline' });
    expect(result.telemetry.errorRate).toBeLessThan(1);
    expect(result.disconnected).not.toContain('a1');
  });
  it('a single offline database fails the requests that need it', () => {
    const result = run(setNodeFault(cached(), 'db', 'down'));
    expect(result.telemetry.errorRate).toBeGreaterThan(20);
    expect(result.mentor.id).toBe('outage');
  });
  it('added latency appears in the trace', () => {
    const slow = run(setNodeFault(cached(), 'db', 'slow'));
    expect(slow.telemetry.p95).toBe(run(cached()).telemetry.p95 + 200);
    expect(slow.trace.reduce((sum, span) => sum + span.duration, 0)).toBe(slow.telemetry.p95);
  });
});

describe('free-form graphs', () => {
  it('design-only components pass traffic through and are reported honestly', () => {
    const base = cached();
    const architecture = graph(
      [...base.nodes.map((node): Spec => [node.id, node.kind]), ['k8s', 'kubernetes']],
      [...base.edges.filter(edge => edge.id !== 'users-lb').map((edge): [string, string] => [edge.source, edge.target]), ['users', 'k8s'], ['k8s', 'lb']],
    );
    const result = run(architecture);
    expect(result.telemetry.p95).toBe(145);
    expect(result.notes.some(note => note.includes('k8s is design-only'))).toBe(true);
    expect(result.telemetry.cost).toBe(run(cached()).telemetry.cost);
  });
  it('ignores loops and meaningless links with an explanation', () => {
    const architecture = cached();
    architecture.edges.push({ id: 'a1-a2', source: 'a1', target: 'a2' }, { id: 'a2-a1', source: 'a2', target: 'a1' }, { id: 'db-a3', source: 'db', target: 'a3' });
    const result = run(architecture);
    expect(result.notes.some(note => note.includes('loop'))).toBe(true);
    expect(result.notes.some(note => note.includes('db → a3 is drawn but not simulated'))).toBe(true);
    expect(Object.values(result.telemetry).every(Number.isFinite)).toBe(true);
  });
  it('splits load across several databases like shards', () => {
    const base = front();
    const one = run(graph([...base.nodes, ['db', 'postgres']], [...base.edges, ...apis.map((id): [string, string] => [id, 'db'])]));
    const two = run(graph(
      [...base.nodes, ['db', 'postgres'], ['db2', 'mysql']],
      [...base.edges, ...apis.flatMap((id): [string, string][] => [[id, 'db'], [id, 'db2']])],
    ));
    expect(two.telemetry.dbCpu).toBeLessThan(one.telemetry.dbCpu);
    expect(two.telemetry.cost).toBe(one.telemetry.cost + 600);
  });
  it('an empty board runs and reports that no client source exists', () => {
    const result = run({ nodes: [], edges: [] });
    expect(result.telemetry.errorRate).toBe(100);
    expect(result.notes.some(note => note.includes('No client source'))).toBe(true);
  });
  it('stays deterministic and leaves complex inputs untouched', () => {
    const architecture = configureNode(setNodeFault(cached(), 'a2', 'slow'), 'redis', { memoryGb: 2 });
    const before = JSON.stringify(architecture);
    expect(run(architecture)).toEqual(run(architecture));
    expect(JSON.stringify(architecture)).toBe(before);
  });
});
