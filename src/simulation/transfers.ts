import { definitions, isApi } from '../data/component-definitions';
import { requestHandlingDefinition } from '../data/request-policies';
import { monthlyCost } from './cost';
import { clamp, healthForCpu, objectivePasses, round } from './formulas';
import type { ArchitectureState, AttemptOutcome, IncidentEvent, LedgerPosting, NodeTelemetry, RetryPolicy, SimulationInput, SimulationResult, TelemetrySnapshot, TraceSpan, TransferRecord, TransferResponse } from './types';

export function retryPolicy(architecture: ArchitectureState): RetryPolicy {
  return architecture.nodes.find(node => node.kind === 'users')?.retryPolicy ?? { enabled: true, keyStrategy: 'same-key' };
}

export const transferMoney = (minor: number, currency: string) => new Intl.NumberFormat('en-NG', {
  style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(minor / 100);

/** Replays an authored HTTP request sequence against a fresh integer-valued ledger. */
export function simulateTransfers({ scenario, architecture, traffic = scenario.trafficProfile.peak, phase = scenario.scriptedEvents.length - 1 }: SimulationInput): SimulationResult {
  const fixture = scenario.transfers;
  if (!fixture) throw new Error('Transfer scenarios require an authored transfer fixture.');
  const load = Math.max(0, Number.isFinite(traffic) ? traffic : 0);
  const step = clamp(Number.isFinite(phase) ? Math.floor(phase) : 0, 0, scenario.scriptedEvents.length - 1);
  const policy = retryPolicy(architecture);
  const handler = requestHandlingDefinition(architecture);
  const { nodes, edges } = architecture;
  const linked = (source: string, target: string) => edges.some(edge => edge.source === source && edge.target === target);
  const db = nodes.find(node => node.kind === 'postgres');
  const clients = nodes.filter(node => node.kind === 'users');
  const balancers = nodes.filter(node => node.kind === 'load-balancer' && clients.some(client => linked(client.id, node.id)));
  const apis = nodes.filter(node => isApi(node.kind));
  const routed = apis.filter(node => balancers.some(balancer => linked(balancer.id, node.id)));
  const caches = nodes.filter(node => node.kind === 'redis' && db && linked(node.id, db.id));
  // Redis is a read cache: transfer writes still reach authoritative PostgreSQL.
  const viaCache = (id: string) => caches.some(cache => linked(id, cache.id));
  const reachable = (id: string) => !!db && (linked(id, db.id) || viaCache(id));
  const active = routed.filter(api => reachable(api.id));
  const disconnected = apis.filter(api => !active.some(node => node.id === api.id)).map(api => api.label);
  const sharedRecords = new Map<string, TransferRecord>();
  const workerRecords = new Map<string, Map<string, TransferRecord>>();
  const confirmed = new Set<string>();
  const requested = new Set<string>();
  const postings: LedgerPosting[] = [];
  const attempts: AttemptOutcome[] = [];
  const logs: IncidentEvent[] = [{ time: '09:15:00.000', level: 'INFO', message: `Scripted account opened · ${fixture.account} · ${transferMoney(fixture.openingBalanceMinor, fixture.currency)}` }];
  let balance = fixture.openingBalanceMinor;

  fixture.attempts.forEach((request, index) => {
    if (request.phase > step || (request.attempt > 1 && !policy.enabled)) return;
    const intent = fixture.intents.find(item => item.id === request.transferId);
    if (!intent) throw new Error(`Unknown authored transfer: ${request.transferId}`);
    requested.add(intent.id);
    const api = routed[index % Math.max(1, routed.length)];
    const key = policy.keyStrategy === 'none' ? null : request.attempt > 1 && policy.keyStrategy === 'new-key' ? `${intent.key}-retry-${request.attempt}` : intent.key;
    if (api && request.restartWorker) {
      workerRecords.delete(api.id);
      logs.push({ time: request.time, level: 'WARN', message: `${api.label} restarted before retry · local memory cleared · PostgreSQL transfer records retained` });
    }
    if (api && !workerRecords.has(api.id)) workerRecords.set(api.id, new Map());
    const records = handler.value === 'postgres' ? sharedRecords : handler.value === 'worker-memory' && api ? workerRecords.get(api.id) : undefined;
    const fingerprint = JSON.stringify({ recipient: intent.recipient, amountMinor: intent.amountMinor, currency: fixture.currency });
    const scope = JSON.stringify([fixture.account, key]);
    const saved = key ? records?.get(scope) : undefined;
    let outcome: AttemptOutcome['outcome'];
    let lookup: AttemptOutcome['lookup'] = 'skipped';
    let response: TransferResponse | null = null;
    const canProcess = api && reachable(api.id);

    if (!canProcess) outcome = 'unavailable';
    else {
      lookup = key && records ? saved ? saved.fingerprint === fingerprint ? 'hit' : 'conflict' : 'miss' : 'skipped';
      if (lookup === 'conflict') outcome = 'conflict';
      else if (saved) { outcome = 'replayed'; response = saved.response; }
      else {
        outcome = 'committed';
        response = { receiptId: `receipt-${String(postings.length + 1).padStart(3, '0')}`, transferId: intent.id, recipient: intent.recipient, amountMinor: intent.amountMinor, currency: fixture.currency, status: 'completed' };
        const duplicate = postings.some(posting => posting.transferId === intent.id);
        balance -= intent.amountMinor;
        postings.push({ receiptId: response.receiptId, transferId: intent.id, recipient: intent.recipient, key, apiId: api.id, time: request.time, amountMinor: intent.amountMinor, balanceMinor: balance, duplicate });
        // PostgreSQL mode models a UNIQUE(account, key) reservation, debit, and
        // response persisted in one atomic transaction. Memory mode is per worker.
        if (key && records) records.set(scope, { key, account: fixture.account, fingerprint, apiId: api.id, response });
      }
    }
    const successful = outcome === 'committed' || outcome === 'replayed';
    if (successful && !request.responseLost) confirmed.add(intent.id);
    attempts.push({ ...request, apiId: api?.id ?? 'unrouted', key, outcome, lookup, response, receiptId: response?.receiptId ?? null,
      recipient: intent.recipient, requestedAmountMinor: intent.amountMinor, amountMinor: outcome === 'committed' ? intent.amountMinor : 0, balanceMinor: balance });
    logs.push({ time: request.time, level: successful ? 'INFO' : 'ERROR', message: `POST /transfers · ${request.id} · ${api?.label ?? 'no API route'} · Idempotency-Key: ${key ?? '(absent)'} · lookup=${lookup} · ${outcome}${response ? ` · ${response.receiptId}` : ''}` });
    if (lookup === 'miss') logs.push({ time: request.time, level: 'INFO', message: `${handler.value === 'postgres' ? 'PostgreSQL transfers' : 'Worker-local records'} lookup: no matching account/key · process transfer and store response` });
    if (outcome === 'committed' && handler.value === 'postgres' && key) logs.push({ time: request.time, level: 'INFO', message: 'COMMIT · unique account/key + debit + response JSON · one atomic transaction' });
    if (successful && request.responseLost) logs.push({ time: request.time, level: 'WARN', message: `${response?.receiptId} committed; response lost · client timeout after ${fixture.timeoutMs}ms · the debit was NOT rolled back` });
    if (outcome === 'committed' && postings[postings.length - 1].duplicate) logs.push({ time: request.time, level: 'ERROR', message: `Duplicate debit for ${intent.id} · same intent, new receipt · ${transferMoney(intent.amountMinor, fixture.currency)} debited again` });
    if (outcome === 'replayed') logs.push({ time: request.time, level: 'INFO', message: `Matching transfer found · returning stored response ${response?.receiptId} · no additional debit` });
    if (outcome === 'conflict') logs.push({ time: request.time, level: 'ERROR', message: '409 key/payload conflict · rejected without moving money' });
  });

  const capacity = active.reduce((sum, api) => sum + definitions[api.kind].capacity, 0);
  const apiPressure = capacity ? load / capacity : 100;
  const dbPressure = load / (definitions.postgres.writeCapacity ?? definitions.postgres.capacity);
  const apiCpu = active.length ? round(clamp(18 + apiPressure * 78, 0, 98)) : 0;
  const dbCpu = active.length ? round(clamp(18 + dbPressure * 67, 0, 97)) : 0;
  const duplicateDebits = postings.filter(posting => posting.duplicate).length;
  const expected = fixture.openingBalanceMinor - fixture.intents.filter(intent => requested.has(intent.id)).reduce((sum, intent) => sum + intent.amountMinor, 0);
  const completionRate = round(confirmed.size / Math.max(1, fixture.intents.length) * 100, 2);
  const queue = round(Math.max(0, apiPressure - 1) * scenario.model.apiQueueFactor + Math.max(0, dbPressure - 1) * scenario.model.dbQueueFactor);
  const cacheOverhead = active.some(api => viaCache(api.id)) ? definitions.redis.baseLatency : 0;
  const acceptedLatency = scenario.model.baseP95 + handler.lookupMs + cacheOverhead + queue;
  const t: TelemetrySnapshot = {
    traffic: load, apiCpu, dbCpu, dbConnections: active.length ? Math.min(100, Math.ceil(15 + dbPressure * 80)) : 0,
    cacheHitRate: 0, p95: active.length ? acceptedLatency : 2000, errorRate: round(100 - completionRate, 2),
    incorrectBalances: balance === expected ? 0 : 1, availability: completionRate, cost: monthlyCost(architecture),
    duplicateDebits, retryAttempts: attempts.filter(attempt => attempt.attempt > 1).length,
    replayedRequests: attempts.filter(attempt => attempt.outcome === 'replayed').length, completionRate,
  };
  const perNode: Record<string, NodeTelemetry> = {};
  for (const node of nodes) {
    const serving = isApi(node.kind) ? active.some(api => api.id === node.id)
      : node.kind === 'redis' ? caches.some(cache => cache.id === node.id) && active.some(api => linked(api.id, node.id))
      : node.kind === 'load-balancer' ? balancers.some(balancer => balancer.id === node.id) : active.length > 0;
    const cpu = isApi(node.kind) ? apiCpu : node.kind === 'postgres' ? dbCpu : node.kind === 'redis' ? round(12 + load / definitions.redis.capacity * 65) : node.kind === 'load-balancer' ? round(8 + load / definitions[node.kind].capacity * 70) : 0;
    const health = !serving ? 'failed' : node.kind === 'postgres' && duplicateDebits > 0 ? 'critical' : healthForCpu(cpu);
    perNode[node.id] = {
      traffic: !serving ? 0 : isApi(node.kind) ? round(load * definitions[node.kind].capacity / Math.max(1, capacity)) : load,
      cpu: serving ? cpu : 0, memory: serving && cpu ? round(28 + cpu * 0.45) : 0, health,
      ...(node.kind === 'postgres' ? { connections: t.dbConnections, detail: duplicateDebits > 0 ? `${duplicateDebits} duplicate debits` : undefined } : {}),
      ...(node.kind === 'redis' ? { cacheHitRate: 0, detail: 'Writes pass through' } : {}),
    };
  }
  const objectives = scenario.objectives.map(objective => ({ ...objective, actual: t[objective.id], passed: objectivePasses(objective, t[objective.id]) }));
  const stable = objectives.every(objective => objective.passed);
  const mentorKey = stable ? 'success' : attempts.some(a => a.outcome === 'unavailable') ? 'disconnected'
    : attempts.some(a => a.outcome === 'conflict') ? 'conflict'
    : duplicateDebits > 0 ? policy.keyStrategy === 'none' ? 'missingKey' : handler.value !== 'always-create' && policy.keyStrategy === 'new-key' ? 'newKey' : handler.value === 'worker-memory' ? 'workerMemory' : nodes.some(n => n.kind === 'redis') ? 'cacheOnly' : 'duplicate'
    : !policy.enabled && completionRate < 100 ? 'unconfirmed' : t.cost > scenario.budget ? 'budget' : step < scenario.scriptedEvents.length - 1 ? 'pending' : 'compute';
  const first = attempts[0];
  const firstRetry = attempts.find(attempt => attempt.transferId === first?.transferId && attempt.attempt > 1);
  const trace: TraceSpan[] = !first ? [] : [
    ...(first.lookup !== 'skipped' ? [{ name: handler.value === 'postgres' ? 'Lookup transfer key' : 'Lookup worker memory', duration: handler.lookupMs, kind: 'data' as const }] : []),
    { name: first.outcome === 'unavailable' ? 'Routing failure' : 'Commit transfer', duration: first.outcome === 'unavailable' ? 2000 : acceptedLatency - (first.lookup !== 'skipped' ? handler.lookupMs : 0), kind: 'data' },
    ...(first.responseLost && first.outcome === 'committed' ? [{ name: 'Client timeout', duration: fixture.timeoutMs, kind: 'other' as const }] : []),
    ...(firstRetry ? [{ name: firstRetry.outcome === 'replayed' ? 'Replay stored response' : firstRetry.outcome === 'unavailable' ? 'Retry unavailable' : firstRetry.outcome === 'conflict' ? 'Reject key conflict' : 'Retry: new debit', duration: firstRetry.outcome === 'replayed' ? 8 : firstRetry.outcome === 'unavailable' ? 2000 : acceptedLatency, kind: 'compute' as const }] : []),
  ];
  const records = handler.value === 'postgres' ? [...sharedRecords.values()] : [...workerRecords.values()].flatMap(records => [...records.values()]);
  return {
    telemetry: t, nodes: perNode, objectives, logs, trace, disconnected,
    mentor: scenario.mentorRules[mentorKey], missionState: stable ? 'stable' : 'incident',
    ledger: { account: fixture.account, currency: fixture.currency, openingBalanceMinor: fixture.openingBalanceMinor, expectedBalanceMinor: expected, actualBalanceMinor: balance, postings, attempts, plannedTransfers: fixture.intents.length, confirmedTransfers: confirmed.size, recordStore: handler.value, records },
  };
}
