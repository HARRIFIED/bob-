import { definitions, isApi } from '../data/component-definitions';
import { cpuFor } from './component-model';
import { monthlyCost } from './cost';
import { simulateFlow, percentileTerminal } from './flow';
import { clamp, objectivePasses, round } from './formulas';
import { brokenTrace, generateLogs } from './telemetry';
import { simulateTransfers } from './transfers';
import type { NodeTelemetry, SimulationInput, SimulationResult, TelemetrySnapshot } from './types';

/** Pure educational model: identical input produces identical output. No clock, network, or RNG. */
export function simulate({ scenario, architecture, traffic = scenario.trafficProfile.peak, phase }: SimulationInput): SimulationResult {
  if (scenario.engine === 'transfers') return simulateTransfers({ scenario, architecture, traffic, phase });
  traffic = Math.max(0, Number.isFinite(traffic) ? traffic : 0);
  const flow = simulateFlow({ architecture, traffic, scenario });
  const entries = architecture.nodes.flatMap(node => {
    const measured = flow.nodes.get(node.id);
    return measured ? [{ node, flow: measured }] : [];
  });
  const apis = entries.filter(entry => isApi(entry.node.kind));
  const serving = apis.filter(entry => !entry.flow.idle && entry.node.fault !== 'down');
  const apiCapacity = serving.reduce((sum, entry) => sum + definitions[entry.node.kind].capacity, 0);
  const apiPressure = apiCapacity ? serving.reduce((sum, entry) => sum + entry.flow.pressure * definitions[entry.node.kind].capacity, 0) / apiCapacity : 0;
  const primaries = entries.filter(entry => entry.flow.role === 'database' && !entry.flow.idle && entry.node.fault !== 'down');
  const busiest = primaries.reduce<(typeof primaries)[number] | undefined>((top, entry) => !top || entry.flow.pressure > top.flow.pressure ? entry : top, undefined);
  const replicas = entries.filter(entry => entry.flow.role === 'replica' && !entry.flow.idle);
  const queues = entries.filter(entry => entry.flow.role === 'queue' && !entry.flow.idle);
  const hits = entries.filter(entry => entry.flow.role === 'cache').reduce((sum, entry) => sum + entry.flow.hits, 0);
  const tail = percentileTerminal(flow.terminals, traffic);
  const errorRate = traffic > 0 ? round(clamp(0.04 + (flow.overloadErrors + flow.failedRate) / traffic * 100, 0, 100), 2) : 0;
  const staleReads = round(flow.staleReads, 1);
  const disconnected = apis.filter(entry => entry.node.fault !== 'down' && (entry.flow.idle || entry.flow.failed > 0)).map(entry => entry.node.label);

  const t: TelemetrySnapshot = {
    traffic,
    apiCpu: serving.length ? cpuFor('compute', apiPressure) : 0,
    dbCpu: busiest?.flow.cpu ?? 0,
    dbConnections: busiest?.flow.connections ?? 0,
    cacheHitRate: flow.clientReads > 0 ? round(hits / flow.clientReads * 100) : 0,
    p95: tail?.latency ?? 0,
    errorRate,
    incorrectBalances: staleReads >= 0.05 ? Math.ceil(staleReads) : 0,
    availability: round(100 - errorRate, 2),
    cost: monthlyCost(architecture),
    duplicateDebits: 0, retryAttempts: 0, replayedRequests: 0, completionRate: 0,
    staleReads,
    queueBacklog: round(queues.reduce((sum, entry) => sum + entry.flow.backlog, 0)),
    asyncLag: round(Math.max(0, ...queues.map(entry => entry.flow.lagMs)) / 1000, 1),
    replicaLag: Math.max(0, ...replicas.map(entry => entry.flow.lagMs)),
  };

  const perNode: Record<string, NodeTelemetry> = {};
  for (const { node, flow: measured } of entries) {
    const role = measured.role;
    const detail = node.fault === 'down' ? 'Offline'
      : role === 'design' ? 'Design-only'
      : node.fault === 'cold' && !measured.idle ? `Cold · ${round(measured.hitRate * 100)}% hits`
      : role === 'replica' && !measured.idle ? `Lag ${measured.lagMs} ms`
      : role === 'queue' && !measured.idle ? measured.backlog > 0 ? `${Math.round(measured.backlog).toLocaleString('en-US')} queued` : `${Math.round(measured.drained).toLocaleString('en-US')} msg/s`
      : role === 'consumer' && !measured.idle ? `${Math.round(measured.arriving).toLocaleString('en-US')} jobs/s`
      : node.fault === 'slow' && !measured.idle ? `${measured.cpu}% CPU · +200 ms` : undefined;
    perNode[node.id] = {
      traffic: round(measured.arriving), cpu: measured.cpu, memory: round(measured.cpu ? 28 + measured.cpu * 0.45 : 0), health: measured.health,
      ...(role === 'database' || role === 'replica' ? { connections: measured.connections } : {}),
      ...(role === 'cache' ? { cacheHitRate: measured.idle ? 0 : round(measured.hitRate * 100) } : {}),
      ...(role === 'replica' ? { lagMs: measured.lagMs } : {}),
      ...(role === 'queue' ? { backlog: round(measured.backlog) } : {}),
      ...(detail ? { detail } : {}),
    };
  }

  const objectives = scenario.objectives.map(objective => ({ ...objective, actual: t[objective.id], passed: objectivePasses(objective, t[objective.id]) }));
  const stable = objectives.every(objective => objective.passed);
  const initialApiCount = scenario.initialArchitecture.nodes.filter(node => isApi(node.kind)).length;
  const outage = flow.failedRate > 0 && architecture.nodes.some(node => node.fault === 'down');
  const mentorKey = stable && objectives.length ? 'success'
    : outage ? 'outage'
    : flow.failedRate > 0 || disconnected.length ? 'disconnected'
    : primaries.some(entry => entry.flow.pressure >= 1) ? apis.length > initialApiCount ? 'computeOnly' : 'database'
    : replicas.some(entry => entry.flow.pressure >= 1) ? 'replica'
    : apiPressure > 1 ? 'compute'
    : t.incorrectBalances > 0 ? 'stale'
    : t.queueBacklog > 0 ? 'backlog'
    : t.cost > scenario.budget ? 'budget'
    : objectives.length ? 'compute' : 'healthy';
  return {
    telemetry: t, nodes: perNode,
    logs: generateLogs({ telemetry: t, disconnected, scenario, architecture, flow }),
    trace: !tail ? [] : tail.failed ? brokenTrace : tail.spans,
    objectives,
    mentor: scenario.mentorRules[mentorKey] ?? scenario.mentorRules.compute ?? { id: mentorKey, text: '' },
    missionState: stable ? 'stable' : 'incident',
    disconnected,
    notes: flow.notes,
  };
}
