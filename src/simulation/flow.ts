import { definitions, isApi, nodeConfig, roleOf } from '../data/component-definitions';
import {
  asyncProcessingMs, backlogWindowSeconds, cacheDownPenaltyMs, cacheHitRate, cpuFor, defaultFollowUpReadShare,
  defaultWorkingSetGb, maxAsyncLagMs, overloadErrorPct, queueDelay, replicaLagMs, requestOverhead, slowFaultMs,
  staleProbability, timeoutMs,
} from './component-model';
import { healthForCpu } from './formulas';
import type { ArchitectureNode, ArchitectureState, ComponentRole, Health, ScenarioDefinition, TraceSpan } from './types';

type ClientOp = 'reads' | 'writes';
/** 'async' carries queued writes from a queue to its consumers. It never blocks a client response. */
type Op = ClientOp | 'async';
const ops: Op[] = ['reads', 'writes', 'async'];

interface Share { id: string; share: number }
interface Route { served: number; failed: number; children: Share[]; reason?: string }
type Routes = Record<Op, Route>;

/** Which roles each role may send requests to. Anything else is drawn but not simulated. */
const routeTargets: Record<ComponentRole, ComponentRole[]> = {
  source: ['router', 'compute', 'design'],
  router: ['router', 'compute', 'design'],
  design: ['router', 'compute', 'consumer', 'cache', 'database', 'replica', 'queue', 'design'],
  compute: ['compute', 'router', 'design', 'cache', 'database', 'replica', 'queue'],
  consumer: ['database', 'cache', 'queue', 'design'],
  cache: ['database', 'replica', 'design'],
  database: [],
  replica: [],
  queue: ['consumer', 'compute', 'design'],
};
const ignoredReason: Record<ComponentRole, string> = {
  source: 'clients send requests to a load balancer, an API, or a design-only boundary',
  router: 'load balancers forward requests to APIs or other load balancers',
  design: 'clients cannot receive requests',
  compute: 'APIs call caches, databases, replicas, queues, or other services; background workers consume from a queue',
  consumer: 'background workers write to databases, caches, or queues',
  cache: 'a cache sends misses and writes to a database or read replica',
  database: 'databases answer requests; only primary → read replica replication is modeled',
  replica: 'read replicas answer reads and do not forward requests',
  queue: 'queues deliver messages to background workers or APIs',
};

export interface GraphAnalysis {
  /** Topological order over request connections, sources first. */
  order: ArchitectureNode[];
  children: Map<string, ArchitectureNode[]>;
  /** Replica id → the primaries it replicates from. */
  primaries: Map<string, ArchitectureNode[]>;
  notes: string[];
}

/** Classify drawn connections and order the graph. Loops and meaningless links are reported, not simulated. */
export function analyzeGraph(architecture: ArchitectureState): GraphAnalysis {
  const byId = new Map(architecture.nodes.map(node => [node.id, node]));
  const requestEdges = new Map<string, ArchitectureNode[]>(architecture.nodes.map(node => [node.id, []]));
  const primaries = new Map<string, ArchitectureNode[]>();
  const notes: string[] = [];
  for (const edge of architecture.edges) {
    const from = byId.get(edge.source);
    const to = byId.get(edge.target);
    if (!from || !to || from.id === to.id) continue;
    const fromRole = roleOf(from);
    const toRole = roleOf(to);
    if (fromRole === 'database' && toRole === 'replica') {
      primaries.set(to.id, [...(primaries.get(to.id) ?? []), from]);
    } else if (toRole !== 'source' && routeTargets[fromRole].includes(toRole)) {
      requestEdges.get(from.id)?.push(to);
    } else {
      notes.push(`${from.label} → ${to.label} is drawn but not simulated: ${toRole === 'source' ? ignoredReason.design : ignoredReason[fromRole]}.`);
    }
  }
  const children = new Map<string, ArchitectureNode[]>(architecture.nodes.map(node => [node.id, []]));
  const state = new Map<string, 'visiting' | 'done'>();
  const finished: ArchitectureNode[] = [];
  const visit = (node: ArchitectureNode) => {
    state.set(node.id, 'visiting');
    for (const child of requestEdges.get(node.id) ?? []) {
      const seen = state.get(child.id);
      if (seen === 'visiting') {
        notes.push(`${node.label} → ${child.label} would create a loop, so requests do not follow it.`);
        continue;
      }
      children.get(node.id)?.push(child);
      if (!seen) visit(child);
    }
    state.set(node.id, 'done');
    finished.push(node);
  };
  const sources = architecture.nodes.filter(node => roleOf(node) === 'source');
  for (const node of [...sources, ...architecture.nodes]) {
    if (!state.has(node.id)) visit(node);
  }
  for (const node of architecture.nodes.filter(item => roleOf(item) === 'design')) {
    notes.push(`${node.label} is design-only: traffic drawn through it passes unchanged, and it is unpriced.`);
  }
  return { order: finished.reverse(), children, primaries, notes };
}

export interface NodeFlow {
  role: ComponentRole;
  load: Record<Op, number>;
  arriving: number;
  servedReads: number;
  /** Client requests per second that failed at this node. */
  failed: number;
  asyncDropped: number;
  reasons: string[];
  hitRate: number;
  hits: number;
  readsToCaches: { id: string; amount: number }[];
  pressure: number;
  cpu: number;
  delay: number;
  errorPct: number;
  connections: number;
  lagMs: number;
  backlog: number;
  drained: number;
  rejected: number;
  acknowledged: number;
  rywProtected: boolean;
  idle: boolean;
  health: Health;
}
export interface FlowTerminal { rate: number; latency: number; spans: TraceSpan[]; failed: boolean }
export interface FlowResult {
  nodes: Map<string, NodeFlow>;
  notes: string[];
  terminals: FlowTerminal[];
  clientReads: number;
  failedRate: number;
  overloadErrors: number;
  staleReads: number;
}

const emptyFlow = (role: ComponentRole): NodeFlow => ({
  role, load: { reads: 0, writes: 0, async: 0 }, arriving: 0, servedReads: 0, failed: 0, asyncDropped: 0, reasons: [],
  hitRate: 0, hits: 0, readsToCaches: [], pressure: 0, cpu: 0, delay: 0, errorPct: 0, connections: 0,
  lagMs: 0, backlog: 0, drained: 0, rejected: 0, acknowledged: 0, rywProtected: false, idle: true, health: 'healthy',
});
const healthRank: Health[] = ['healthy', 'warning', 'critical', 'failed'];
const worst = (a: Health, b: Health) => healthRank.indexOf(a) >= healthRank.indexOf(b) ? a : b;

/**
 * Deterministic flow model: requests travel the drawn graph from client sources.
 * Pure — no clock, randomness, or input mutation.
 */
export function simulateFlow({ architecture, traffic, scenario }: { architecture: ArchitectureState; traffic: number; scenario: ScenarioDefinition }): FlowResult {
  const graph = analyzeGraph(architecture);
  const notes = [...graph.notes];
  const note = (text: string) => { if (!notes.includes(text)) notes.push(text); };
  const { readFraction, writeWeight } = scenario.trafficProfile;
  const { model } = scenario;
  const workingSetGb = model.workingSetGb ?? defaultWorkingSetGb;
  const followUp = model.followUpReadShare ?? defaultFollowUpReadShare;
  const byId = new Map(architecture.nodes.map(node => [node.id, node]));
  const flows = new Map(architecture.nodes.map(node => [node.id, emptyFlow(roleOf(node))]));
  const flowOf = (node: ArchitectureNode) => flows.get(node.id) ?? emptyFlow(roleOf(node));
  const routes = new Map<string, Routes>();
  const kids = (node: ArchitectureNode) => graph.children.get(node.id) ?? [];
  const ofRole = (node: ArchitectureNode, ...roles: ComponentRole[]) => kids(node).filter(child => roles.includes(roleOf(child)));
  const hasPrimary = (node: ArchitectureNode) => (graph.primaries.get(node.id) ?? []).length > 0;
  const preferUp = (targets: ArchitectureNode[]) => {
    const up = targets.filter(target => target.fault !== 'down');
    return up.length ? up : targets;
  };
  const weight = (node: ArchitectureNode, depth = 0): number => {
    if (roleOf(node) !== 'design') return definitions[node.kind].capacity || 1;
    if (depth > 8) return 1;
    return kids(node).reduce((sum, child) => sum + weight(child, depth + 1), 0) || 1;
  };
  const split = (targets: ArchitectureNode[], scale = 1): Share[] => {
    const total = targets.reduce((sum, target) => sum + weight(target), 0);
    return targets.map(target => ({ id: target.id, share: scale * weight(target) / total }));
  };
  const serve = (): Route => ({ served: 1, failed: 0, children: [] });
  const fail = (reason: string): Route => ({ served: 0, failed: 1, children: [], reason });
  const forward = (targets: ArchitectureNode[], reason: string): Route => targets.length ? { served: 0, failed: 0, children: split(targets) } : fail(reason);
  const all = (route: Route): Routes => ({ reads: route, writes: route, async: route });

  /** Reads to databases and replicas, split by capacity. Optional read-your-writes routing. */
  const storeRoute = (node: ArchitectureNode, flow: NodeFlow, readYourWrites: boolean, scale = 1): Route | null => {
    const primaries = ofRole(node, 'database');
    const replicas = ofRole(node, 'replica');
    const upPrimaries = primaries.filter(primary => primary.fault !== 'down');
    // Offline replicas are skipped (health checks); a replica with no primary still receives reads and fails them visibly.
    const upReplicas = replicas.filter(replica => replica.fault !== 'down');
    if (!primaries.length && !replicas.length) return null;
    const targets = upPrimaries.length || upReplicas.length ? [...upPrimaries, ...upReplicas] : [...primaries, ...replicas];
    const shares = split(targets, scale);
    const guarded = shares.filter(share => upReplicas.some(replica => replica.id === share.id && hasPrimary(replica) && nodeConfig(replica).readYourWrites));
    if (readYourWrites && guarded.length) {
      if (!upPrimaries.length) {
        note(`Read-your-writes routing needs ${node.label} to connect to the primary database as well.`);
      } else {
        const ratio = flow.load.reads ? Math.min(1, followUp * (flow.load.writes + flow.load.async) / flow.load.reads) : 0;
        const moved = guarded.reduce((sum, share) => sum + share.share * ratio, 0);
        const primaryWeight = upPrimaries.reduce((sum, primary) => sum + weight(primary), 0);
        for (const share of shares) {
          if (guarded.includes(share)) share.share *= 1 - ratio;
          const primary = upPrimaries.find(item => item.id === share.id);
          if (primary) share.share += moved * weight(primary) / primaryWeight;
        }
        for (const share of guarded) {
          const replica = byId.get(share.id);
          if (replica) flowOf(replica).rywProtected = true;
        }
      }
    }
    return { served: 0, failed: 0, children: shares };
  };

  const computeRoutes = (node: ArchitectureNode, flow: NodeFlow): Routes => {
    if (node.fault === 'down') return all(fail(`${node.label} is offline`));
    const caches = preferUp(ofRole(node, 'cache'));
    const primaries = preferUp(ofRole(node, 'database'));
    const queues = preferUp(ofRole(node, 'queue'));
    const downstream = preferUp(ofRole(node, 'compute', 'router', 'design'));
    const reads = caches.length ? forward(caches, '')
      : storeRoute(node, flow, true) ?? forward(downstream, `${node.label} has no read path to a cache or database`);
    const writeTargets = queues.length ? queues : primaries.length ? primaries : caches.length ? caches : downstream;
    const writes = forward(writeTargets, `${node.label} has no write path to a database or queue`);
    return { reads, writes, async: writes };
  };

  const cacheRoutes = (node: ArchitectureNode, flow: NodeFlow): Routes => {
    const config = nodeConfig(node);
    const down = node.fault === 'down';
    flow.hitRate = down ? 0 : cacheHitRate({
      ttlSeconds: config.ttlSeconds ?? 300, memoryGb: config.memoryGb ?? 4, workingSetGb, cold: node.fault === 'cold',
      capacity: definitions[node.kind].capacity, load: flow.load.reads + flow.load.writes + flow.load.async,
    });
    flow.hits = flow.load.reads * flow.hitRate;
    if (down) note(`${node.label} is offline: every read misses and falls through to the database behind it.`);
    if (node.fault === 'cold') note(`${node.label} was flushed: a cold cache misses almost every read until it warms up.`);
    const misses = storeRoute(node, flow, false, 1 - flow.hitRate);
    const reads: Route = misses
      ? { ...misses, served: flow.hitRate }
      : { served: flow.hitRate, failed: 1 - flow.hitRate, children: [], reason: `${node.label} has no database behind it for cache misses` };
    const primaries = preferUp(ofRole(node, 'database'));
    const writes = forward(primaries.length ? primaries : ofRole(node, 'design'), `${node.label} has no primary database for writes`);
    return { reads, writes, async: writes };
  };

  const canConsume = (consumer: ArchitectureNode) => {
    const role = roleOf(consumer);
    if (role === 'design') return true;
    const outputs = role === 'consumer' ? ofRole(consumer, 'database', 'cache', 'queue', 'design') : kids(consumer);
    if (!outputs.length) note(`${consumer.label} has nowhere to write: connect it to a database.`);
    return outputs.length > 0;
  };

  const queueRoutes = (node: ArchitectureNode, flow: NodeFlow): Routes => {
    const noReads = fail(`${node.label} cannot answer reads`);
    if (node.fault === 'down') return { reads: noReads, writes: fail(`${node.label} is offline`), async: fail(`${node.label} is offline`) };
    const inflow = flow.load.writes + flow.load.async;
    const consumers = kids(node).filter(consumer => consumer.fault !== 'down' && canConsume(consumer));
    const partitions = node.kind === 'kafka' ? nodeConfig(node).partitions ?? 3 : Number.POSITIVE_INFINITY;
    const active = [...consumers]
      .sort((a, b) => weight(b) - weight(a) || a.id.localeCompare(b.id))
      .slice(0, partitions);
    if (consumers.length > active.length) {
      note(`${node.label} has ${partitions} partition${partitions === 1 ? '' : 's'}, so only ${active.length} of ${consumers.length} consumers receive messages.`);
    }
    if (inflow > 0 && !active.length) note(`${node.label} has no working consumer: queued writes are never applied.`);
    const drainCapacity = active.reduce((sum, consumer) => sum + weight(consumer), 0);
    const drained = Math.min(inflow, drainCapacity);
    const backlog = (inflow - drained) * backlogWindowSeconds;
    const maxDepth = definitions[node.kind].maxQueueDepth ?? Number.POSITIVE_INFINITY;
    flow.rejected = Math.max(0, backlog - maxDepth) / backlogWindowSeconds;
    const rejectedShare = inflow ? Math.min(1, flow.rejected / inflow) : 0;
    flow.backlog = Math.min(backlog, maxDepth);
    flow.drained = drained;
    flow.acknowledged = flow.load.writes * (1 - rejectedShare);
    flow.lagMs = inflow <= 0 ? 0 : drained > 0 ? Math.min(maxAsyncLagMs, asyncProcessingMs + flow.backlog / drained * 1000) : maxAsyncLagMs;
    for (const consumer of active) flowOf(consumer).load.async += drained * weight(consumer) / drainCapacity;
    const accepted: Route = {
      served: 1 - rejectedShare, failed: rejectedShare, children: [],
      reason: rejectedShare ? `${node.label} is full and rejects new messages` : undefined,
    };
    return { reads: noReads, writes: accepted, async: accepted };
  };

  const routesFor = (node: ArchitectureNode, flow: NodeFlow): Routes => {
    switch (flow.role) {
      case 'compute': case 'consumer': return computeRoutes(node, flow);
      case 'cache': return cacheRoutes(node, flow);
      case 'queue': return queueRoutes(node, flow);
      case 'database': return node.fault === 'down' ? all(fail(`${node.label} is offline`)) : all(serve());
      case 'replica':
        if (node.fault === 'down') return all(fail(`${node.label} is offline`));
        return {
          reads: hasPrimary(node) ? serve() : fail(`${node.label} has no primary to replicate from`),
          writes: fail(`${node.label} is read-only`), async: fail(`${node.label} is read-only`),
        };
      default:
        if (node.fault === 'down') return all(fail(`${node.label} is offline`));
        return all(forward(preferUp(kids(node)), `${node.label} is not connected to anything downstream`));
    }
  };

  // Pass 1 — route and propagate load in topological order.
  const sources = architecture.nodes.filter(node => roleOf(node) === 'source');
  const clientReads = traffic * readFraction;
  const clientWrites = traffic - clientReads;
  for (const source of sources) {
    flowOf(source).load.reads = clientReads / sources.length;
    flowOf(source).load.writes = clientWrites / sources.length;
  }
  if (!sources.length && traffic > 0) note('No client source: add Customers so the workload has somewhere to start.');
  for (const node of graph.order) {
    const flow = flowOf(node);
    const route = routesFor(node, flow);
    routes.set(node.id, route);
    for (const op of ops) {
      const amount = flow.load[op];
      if (amount <= 0) continue;
      const step = route[op];
      if (op === 'async') flow.asyncDropped += amount * step.failed;
      else flow.failed += amount * step.failed;
      if (step.failed > 0 && step.reason && !flow.reasons.includes(step.reason)) flow.reasons.push(step.reason);
      if (op === 'reads') flow.servedReads += amount * step.served;
      for (const child of step.children) {
        const target = byId.get(child.id);
        if (!target) continue;
        flowOf(target).load[op] += amount * child.share;
        if (op === 'reads' && roleOf(target) === 'cache') flow.readsToCaches.push({ id: child.id, amount: amount * child.share });
      }
    }
  }

  // Pass 2 — pressure, CPU, delay, errors, and health for every node.
  const measure = (node: ArchitectureNode) => {
    const flow = flowOf(node);
    const def = definitions[node.kind];
    flow.arriving = flow.load.reads + flow.load.writes + flow.load.async;
    flow.idle = flow.arriving <= 1e-9;
    switch (flow.role) {
      case 'compute': case 'consumer': {
        const hits = flow.readsToCaches.reduce((sum, item) => sum + item.amount * (flows.get(item.id)?.hitRate ?? 0), 0);
        flow.pressure = Math.max(0, flow.arriving - model.cacheHitRelief * hits) / def.capacity;
        break;
      }
      case 'database':
        flow.pressure = (flow.load.reads + (flow.load.writes + flow.load.async) * writeWeight) / def.capacity;
        break;
      case 'replica': {
        const sourcesOf = graph.primaries.get(node.id) ?? [];
        const replayed = sourcesOf.reduce((sum, primary) => sum + flowOf(primary).load.writes + flowOf(primary).load.async, 0);
        flow.pressure = (flow.load.reads + replayed) / def.capacity;
        flow.lagMs = replicaLagMs(Math.max(0, ...sourcesOf.map(primary => flowOf(primary).pressure)), flow.pressure);
        break;
      }
      case 'queue': flow.pressure = (flow.load.writes + flow.load.async) / def.capacity; break;
      case 'router': case 'cache': flow.pressure = flow.arriving / def.capacity; break;
      default: flow.pressure = 0;
    }
    const down = node.fault === 'down';
    flow.cpu = flow.idle || down ? 0 : cpuFor(flow.role, flow.pressure);
    flow.delay = queueDelay(flow.role, flow.pressure, model)
      + (node.fault === 'slow' ? slowFaultMs : 0)
      + (flow.role === 'cache' && down ? cacheDownPenaltyMs : 0);
    flow.errorPct = overloadErrorPct(flow.role, flow.pressure);
    if ((flow.role === 'database' || flow.role === 'replica') && !flow.idle && !down) {
      flow.connections = Math.min(def.connectionLimit ?? 100, Math.ceil(15 + flow.pressure * 80));
    }
    flow.health = healthOf(node, flow);
  };
  const healthOf = (node: ArchitectureNode, flow: NodeFlow): Health => {
    if (node.fault === 'down') return 'failed';
    if (flow.idle) {
      if (flow.role === 'compute' || flow.role === 'router' || flow.role === 'consumer') return 'failed';
      return flow.role === 'source' || flow.role === 'design' ? 'healthy' : 'warning';
    }
    const clientArriving = flow.load.reads + flow.load.writes;
    const failedShare = clientArriving ? flow.failed / clientArriving : 0;
    if (failedShare >= 0.999) return 'failed';
    let health: Health = flow.role === 'source' || flow.role === 'design' ? 'healthy' : healthForCpu(flow.cpu);
    if (flow.role === 'queue' && flow.backlog > 0) health = worst(health, flow.rejected > 0 ? 'critical' : 'warning');
    if (flow.role === 'replica' && flow.lagMs >= 1000) health = worst(health, 'warning');
    if (failedShare > 0) health = worst(health, 'critical');
    return health;
  };
  for (const node of architecture.nodes) if (roleOf(node) !== 'replica') measure(node);
  for (const node of architecture.nodes) if (roleOf(node) === 'replica') measure(node);

  // Pass 3 — latency buckets for client requests, used for p95 and the illustrative trace.
  interface Bucket { op: ClientOp; rate: number; latency: number; spans: TraceSpan[]; cache: boolean }
  const arrivals = new Map<string, Bucket[]>();
  const arrive = (id: string, bucket: Bucket) => {
    const list = arrivals.get(id) ?? [];
    const same = list.find(item => item.op === bucket.op && item.latency === bucket.latency && item.cache === bucket.cache);
    if (!same) list.push({ ...bucket });
    else {
      if (bucket.rate > same.rate) same.spans = bucket.spans;
      same.rate += bucket.rate;
    }
    arrivals.set(id, list);
  };
  for (const source of sources) {
    arrive(source.id, { op: 'reads', rate: clientReads / sources.length, latency: 0, spans: [], cache: false });
    arrive(source.id, { op: 'writes', rate: clientWrites / sources.length, latency: 0, spans: [], cache: false });
  }
  const terminals: FlowTerminal[] = [];
  let overloadErrors = 0;
  let failedRate = 0;
  if (!sources.length && traffic > 0) {
    failedRate = traffic;
    terminals.push({ rate: traffic, latency: timeoutMs, spans: [], failed: true });
  }
  for (const node of graph.order) {
    const buckets = arrivals.get(node.id);
    const route = routes.get(node.id);
    if (!buckets || !route) continue;
    const flow = flowOf(node);
    const own = spanFor(node, flow);
    for (const bucket of buckets) {
      if (bucket.rate <= 0) continue;
      const step = own ? uniqueSpan(own, bucket.spans, node.label) : null;
      const spans = step ? [...bucket.spans, step] : bucket.spans;
      const latency = bucket.latency + (step?.duration ?? 0);
      const cache = bucket.cache || flow.role === 'cache';
      const outcome = route[bucket.op];
      overloadErrors += bucket.rate * (1 - outcome.failed) * flow.errorPct / 100;
      if (outcome.failed > 0) {
        failedRate += bucket.rate * outcome.failed;
        terminals.push({ rate: bucket.rate * outcome.failed, latency: timeoutMs, spans: [], failed: true });
      }
      if (outcome.served > 0) {
        const complete = withOverhead(spans, cache);
        terminals.push({ rate: bucket.rate * outcome.served, latency: complete.reduce((sum, span) => sum + span.duration, 0), spans: complete, failed: false });
      }
      for (const child of outcome.children) arrive(child.id, { op: bucket.op, rate: bucket.rate * child.share, latency, spans, cache });
    }
  }

  // Read-your-writes staleness: a follow-up read served by a lagging copy, or before a queued write is applied.
  const allFlows = architecture.nodes.map(node => ({ node, flow: flowOf(node) }));
  const servedReads = allFlows.reduce((sum, item) => sum + item.flow.servedReads, 0);
  const acknowledgedAsync = allFlows.filter(item => item.flow.role === 'queue').reduce((sum, item) => sum + item.flow.acknowledged, 0);
  const asyncLag = acknowledgedAsync
    ? allFlows.filter(item => item.flow.role === 'queue').reduce((sum, item) => sum + item.flow.acknowledged * item.flow.lagMs, 0) / acknowledgedAsync
    : 0;
  const syncWrites = allFlows
    .filter(item => item.flow.role === 'database' && item.node.fault !== 'down')
    .reduce((sum, item) => sum + item.flow.load.writes, 0);
  const staleWindow = (node: ArchitectureNode, flow: NodeFlow) => {
    if (flow.role === 'cache') {
      const config = nodeConfig(node);
      return config.writePolicy === 'ttl-only' ? (config.ttlSeconds ?? 300) * 1000 / 2 : 0;
    }
    return flow.role === 'replica' && !flow.rywProtected ? flow.lagMs : 0;
  };
  const staleReads = servedReads <= 0 ? 0 : followUp * allFlows.reduce((sum, { node, flow }) => {
    if (flow.servedReads <= 0) return sum;
    const share = flow.servedReads / servedReads;
    const window = staleWindow(node, flow);
    return sum + share * (syncWrites * staleProbability(window) + acknowledgedAsync * staleProbability(window + asyncLag));
  }, 0);

  for (const { node, flow } of allFlows) {
    if (flow.asyncDropped > 0) note(`${node.label} could not apply some queued writes: ${flow.reasons.join('; ') || 'no write path'}.`);
  }
  return { nodes: flows, notes, terminals, clientReads, failedRate, overloadErrors, staleReads };
}

function spanFor(node: ArchitectureNode, flow: NodeFlow): TraceSpan | null {
  const def = definitions[node.kind];
  switch (flow.role) {
    case 'compute': return { name: isApi(node.kind) ? 'API' : def.name, duration: def.baseLatency + flow.delay, kind: 'compute' };
    case 'consumer': return { name: def.name, duration: def.baseLatency + flow.delay, kind: 'compute' };
    case 'cache': return { name: 'Redis lookup', duration: def.baseLatency + flow.delay, kind: 'cache' };
    case 'database': return { name: def.name, duration: def.baseLatency + flow.delay, kind: 'data' };
    case 'replica': return { name: 'Read replica', duration: def.baseLatency + flow.delay, kind: 'data' };
    case 'queue': return { name: node.kind === 'kafka' ? 'Append to Kafka' : 'Publish to RabbitMQ', duration: def.baseLatency + flow.delay, kind: 'other' };
    case 'router': return flow.delay > 0 ? { name: 'Load balancer', duration: flow.delay, kind: 'compute' } : null;
    default: return null;
  }
}

/** Repeated hops (e.g. API → API) keep distinct names so trace rows stay readable. */
function uniqueSpan(span: TraceSpan, previous: TraceSpan[], label: string): TraceSpan {
  return previous.some(item => item.name === span.name) ? { ...span, name: `${span.name} · ${label}` } : span;
}

/** Request overhead shared by every completed request: authentication, serialization, and network. */
function withOverhead(spans: TraceSpan[], cache: boolean): TraceSpan[] {
  const firstWork = spans.findIndex(span => span.kind === 'compute' && span.name !== 'Load balancer');
  const at = firstWork + 1;
  return [
    ...spans.slice(0, at),
    { name: 'Authentication', duration: requestOverhead.authentication, kind: 'other' },
    ...spans.slice(at),
    { name: 'Serialization', duration: requestOverhead.serialization, kind: 'other' },
    { name: 'Network', duration: cache ? requestOverhead.networkWithCache : requestOverhead.network, kind: 'other' },
  ];
}

/** The request latency that 95% of client requests beat. Failed requests count as timeouts. */
export function percentileTerminal(terminals: FlowTerminal[], total: number, quantile = 0.95): FlowTerminal | null {
  const sorted = [...terminals].sort((a, b) => b.latency - a.latency || Number(b.failed) - Number(a.failed));
  const tail = total * (1 - quantile);
  let cumulative = 0;
  for (const terminal of sorted) {
    cumulative += terminal.rate;
    if (cumulative >= tail - 1e-9) return terminal;
  }
  return sorted.at(-1) ?? null;
}
