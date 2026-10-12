import { isApi, nodeConfig } from '../data/component-definitions';
import type { FlowResult } from './flow';
import type { ArchitectureState, IncidentEvent, ScenarioDefinition, TelemetrySnapshot, TraceSpan } from './types';

const stamp = (second: number, ms: number) => `08:00:0${second}.${String(Math.min(999, ms)).padStart(3, '0')}`;
const count = (value: number) => Math.round(value).toLocaleString('en-US');

interface LogInput {
  telemetry: TelemetrySnapshot;
  disconnected: string[];
  scenario: ScenarioDefinition;
  architecture: ArchitectureState;
  flow: FlowResult;
}

/** Authored logs derived from the measured flow. Timestamps are illustrative and ordered. */
export function generateLogs({ telemetry: t, disconnected, scenario, architecture, flow }: LogInput): IncidentEvent[] {
  const request = `${scenario.presentation.requestMethod} ${scenario.presentation.requestPath}`;
  const rows: IncidentEvent[] = [
    { time: '08:00:00.012', level: 'INFO', message: `${request} 200 142ms` },
    { time: '08:00:00.048', level: 'INFO', message: `${request} 200 167ms` },
    { time: '08:00:01.000', level: 'INFO', message: `Traffic ramp → ${t.traffic.toLocaleString('en-US')} requests/sec` },
  ];
  const nodes = architecture.nodes.map(node => ({ node, flow: flow.nodes.get(node.id) }));
  nodes.filter(item => item.node.fault).forEach(({ node }, index) => {
    const effect = node.fault === 'down' ? 'is offline' : node.fault === 'slow' ? 'responds 200 ms slower' : 'was flushed and is cold';
    rows.push({ time: stamp(1, 100 + index * 37), level: 'WARN', message: `Injected fault · ${node.label} ${effect}` });
  });
  flow.notes.slice(0, 6).forEach((message, index) => rows.push({ time: stamp(1, 500 + index * 41), level: 'INFO', message: `Model note · ${message}` }));
  if (disconnected.length) rows.push({ time: '08:00:02.015', level: 'ERROR', message: `No complete request path: ${disconnected.join(', ')}` });
  nodes
    .filter(item => item.flow && item.flow.failed > 0 && !isApi(item.node.kind))
    .forEach(({ node, flow: nodeFlow }, index) => rows.push({
      time: stamp(2, 30 + index * 11), level: 'ERROR',
      message: `${count(nodeFlow?.failed ?? 0)} requests/sec failed at ${node.label} · ${nodeFlow?.reasons.join('; ') || 'no route'}`,
    }));
  if (t.cacheHitRate > 0) {
    const ttlOnly = nodes.find(item => item.node.kind === 'redis' && nodeConfig(item.node).writePolicy === 'ttl-only' && !item.flow?.idle);
    const policy = ttlOnly ? `TTL-only · cached balances can be up to ${nodeConfig(ttlOnly.node).ttlSeconds} s old` : 'writes invalidate cached balances';
    rows.push({ time: '08:00:02.105', level: 'INFO', message: `Redis read cache hit rate ${t.cacheHitRate}% · ${policy}` });
  }
  nodes.filter(item => item.flow?.role === 'cache' && item.node.fault === 'cold' && !item.flow.idle).forEach(({ node }, index) => rows.push({
    time: stamp(2, 120 + index * 9), level: 'WARN', message: `${node.label} is cold · misses stampede to the database until popular keys are cached again`,
  }));
  nodes.filter(item => item.flow?.role === 'replica' && !item.flow.idle).forEach(({ node, flow: nodeFlow }, index) => rows.push({
    time: stamp(2, 150 + index * 13), level: (nodeFlow?.lagMs ?? 0) >= 1000 ? 'WARN' : 'INFO',
    message: `${node.label} replication lag ${nodeFlow?.lagMs} ms · ${count(nodeFlow?.servedReads ?? 0)} reads/sec${nodeFlow?.rywProtected ? ' · follow-up reads routed to the primary' : ''}`,
  }));
  nodes.filter(item => item.flow?.role === 'queue' && !item.flow.idle).forEach(({ node, flow: nodeFlow }, index) => {
    const queued = nodeFlow?.backlog ?? 0;
    rows.push({
      time: stamp(2, 200 + index * 17), level: (nodeFlow?.rejected ?? 0) > 0 ? 'ERROR' : queued > 0 ? 'WARN' : 'INFO',
      message: queued > 0
        ? `${node.label} backlog ${count(queued)} messages after 1 min · writes applied ~${Math.round((nodeFlow?.lagMs ?? 0) / 1000)} s late${(nodeFlow?.rejected ?? 0) > 0 ? ' · queue full, rejecting publishes' : ''}`
        : `${node.label} draining ${count(nodeFlow?.drained ?? 0)} messages/sec · no backlog`,
    });
  });
  if (t.staleReads > 0) {
    rows.push({ time: '08:00:02.290', level: 'WARN', message: `${t.staleReads} balance reads/sec may miss the customer’s latest write` });
  }
  if (t.dbCpu >= 85) rows.push(
    { time: '08:00:02.310', level: 'WARN', message: `Database CPU reached ${t.dbCpu}%` },
    { time: '08:00:02.502', level: 'WARN', message: `Database connection pool ${t.dbConnections}/100` },
    { time: '08:00:03.110', level: 'ERROR', message: 'Database connection timeout · pool exhausted' },
  );
  else if (t.dbConnections > 0) rows.push({ time: '08:00:02.502', level: 'INFO', message: `Database connections ${t.dbConnections}/100 · within capacity` });
  if (t.apiCpu >= 95) rows.push({ time: '08:00:03.210', level: 'WARN', message: 'API workers saturated · requests waiting for compute' });
  rows.push({ time: '08:00:04.027', level: t.errorRate >= 1 ? 'ERROR' : 'INFO', message: `${request} ${t.errorRate >= 1 ? '503' : '200'} · p95 ${t.p95}ms · errors ${t.errorRate}%` });
  return rows;
}

/** Trace shown when the p95 request fails: it waits for a dependency that never answers. */
export const brokenTrace: TraceSpan[] = [
  { name: 'API / routing', duration: 28, kind: 'compute' },
  { name: 'Dependency timeout', duration: 1932, kind: 'data' },
  { name: 'Other', duration: 40, kind: 'other' },
];
