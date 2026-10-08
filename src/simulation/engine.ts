import { definitions, isApi } from '../data/component-definitions';
import { monthlyCost } from './cost';
import { clamp, healthForCpu, objectivePasses, round } from './formulas';
import { generateLogs, generateTrace } from './telemetry';
import type { NodeTelemetry, SimulationInput, SimulationResult, TelemetrySnapshot } from './types';

/** Pure educational model: identical input produces identical output. No clock, network, or RNG. */
export function simulate({ scenario, architecture, traffic = scenario.trafficProfile.peak }: SimulationInput): SimulationResult {
  traffic = Math.max(0, Number.isFinite(traffic) ? traffic : 0);
  const { nodes, edges } = architecture;
  const linked = (from: string, to: string) => edges.some(e => e.source === from && e.target === to);
  const sources = nodes.filter(n => n.kind === 'users');
  const balancers = nodes.filter(n => n.kind === 'load-balancer' && sources.some(s => linked(s.id, n.id)));
  const db = nodes.find(n => n.kind === 'postgres');
  const caches = nodes.filter(n => n.kind === 'redis' && db && linked(n.id, db.id));
  const apis = nodes.filter(n => isApi(n.kind));
  const routed = apis.filter(n => balancers.some(b => linked(b.id, n.id)));
  const cached = routed.filter(n => caches.some(c => linked(n.id, c.id)));
  const active = routed.filter(n => (db && linked(n.id, db.id)) || cached.some(c => c.id === n.id));
  const disconnected = apis.filter(n => !active.some(a => a.id === n.id)).map(n => n.label);
  const capacity = active.reduce((sum, n) => sum + definitions[n.kind].capacity, 0);
  const cachedCapacity = cached.reduce((sum, n) => sum + definitions[n.kind].capacity, 0);
  const cacheCoverage = capacity ? cachedCapacity / capacity : 0;
  const hitRate = (definitions.redis.cacheHitRate ?? 0) * cacheCoverage * Math.min(1, definitions.redis.capacity / Math.max(1, traffic));
  const profile = scenario.trafficProfile;
  const dbDemand = traffic * (profile.readFraction * (1 - hitRate) + (1 - profile.readFraction) * profile.writeWeight);
  const dbPressure = db ? dbDemand / definitions[db.kind].capacity : 100;
  const apiPressure = capacity ? traffic * (1 - scenario.model.apiCacheRelief * hitRate) / capacity : 100;
  const apiCpu = round(clamp(18 + apiPressure * 78, 0, 98));
  const dbCpu = round(dbPressure >= 1 ? clamp(90 + dbPressure * 3.2, 90, 97) : 18 + dbPressure * 67);
  const apiQueue = round(Math.min(scenario.model.maxApiQueue, Math.max(0, apiPressure - 1) * scenario.model.apiQueueFactor));
  const dbQueue = round(Math.min(scenario.model.maxDbQueue, Math.max(0, dbPressure - 1) * scenario.model.dbQueueFactor));
  const broken = !active.length || disconnected.length > 0 || !db;
  const brokenShare = !active.length ? 1 : disconnected.length / Math.max(1, apis.length);
  const errorRate = round(clamp(0.04 + Math.max(0, apiPressure - 1) * 2 + Math.min(11, Math.max(0, dbPressure - 1) * 10) + (broken ? brokenShare * 100 : 0), 0, 100), 2);
  const t: TelemetrySnapshot = {
    traffic, apiCpu, dbCpu: active.length ? dbCpu : 0,
    dbConnections: active.length ? Math.min(100, Math.ceil(15 + dbPressure * 80)) : 0,
    cacheHitRate: round(hitRate * 100), p95: broken ? 2000 : scenario.model.baseP95 + apiQueue + dbQueue,
    errorRate, incorrectBalances: 0, availability: round(100 - errorRate, 2), cost: monthlyCost(architecture),
  };
  const perNode: Record<string, NodeTelemetry> = {};
  for (const node of nodes) {
    let load = traffic, cpu = 0, health: NodeTelemetry['health'] = 'healthy';
    if (isApi(node.kind)) {
      const serving = active.some(n => n.id === node.id);
      load = serving ? round(traffic * definitions[node.kind].capacity / Math.max(1, capacity)) : 0;
      cpu = serving ? apiCpu : 0;
      health = serving ? healthForCpu(cpu) : 'failed';
    } else if (node.kind === 'postgres') { load = active.length ? round(traffic * (1 - profile.readFraction * hitRate)) : 0; cpu = t.dbCpu; health = healthForCpu(cpu); }
    else if (node.kind === 'redis') { load = caches.some(c => c.id === node.id) ? round(traffic * profile.readFraction * cacheCoverage) : 0; cpu = load ? round(12 + load / definitions.redis.capacity * 65) : 0; health = load ? healthForCpu(cpu) : 'warning'; }
    else if (node.kind === 'load-balancer') { cpu = round(8 + traffic / definitions[node.kind].capacity * 70); health = balancers.some(b => b.id === node.id) ? healthForCpu(cpu) : 'failed'; }
    perNode[node.id] = { traffic: load, cpu, memory: round(cpu ? 28 + cpu * 0.45 : 0), health,
      ...(node.kind === 'postgres' ? { connections: t.dbConnections } : {}), ...(node.kind === 'redis' ? { cacheHitRate: load ? t.cacheHitRate : 0 } : {}) };
  }
  const objectives = scenario.objectives.map(objective => ({ ...objective, actual: t[objective.id], passed: objectivePasses(objective, t[objective.id]) }));
  const stable = objectives.every(o => o.passed);
  const initialApiCount = scenario.initialArchitecture.nodes.filter(n => isApi(n.kind)).length;
  const mentorKey = stable ? 'success' : broken ? 'disconnected' : dbPressure >= 1 ? (apis.length > initialApiCount ? 'computeOnly' : 'database') : apiPressure > 1 ? 'compute' : t.cost > scenario.budget ? 'budget' : 'compute';
  return { telemetry: t, nodes: perNode, logs: generateLogs(t, disconnected), trace: generateTrace(apiQueue, dbQueue, hitRate > 0, broken), objectives, mentor: scenario.mentorRules[mentorKey], missionState: stable ? 'stable' : 'incident', disconnected };
}
