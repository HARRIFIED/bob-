import type { IncidentEvent, TelemetrySnapshot, TraceSpan } from './types';
export function generateLogs(t: TelemetrySnapshot, disconnected: string[]): IncidentEvent[] {
  const rows: IncidentEvent[] = [
    { time: '08:00:00.012', level: 'INFO', message: 'GET /balance 200 142ms' },
    { time: '08:00:00.048', level: 'INFO', message: 'GET /balance 200 167ms' },
    { time: '08:00:01.000', level: 'INFO', message: `Traffic ramp → ${t.traffic.toLocaleString('en-US')} requests/sec` },
  ];
  if (disconnected.length) rows.push({ time: '08:00:02.015', level: 'ERROR', message: `No complete request path: ${disconnected.join(', ')}` });
  if (t.cacheHitRate > 0) rows.push({ time: '08:00:02.105', level: 'INFO', message: `Redis read cache hit rate ${t.cacheHitRate}% · writes invalidate cached balances` });
  if (t.dbCpu >= 85) rows.push(
    { time: '08:00:02.310', level: 'WARN', message: `Database CPU reached ${t.dbCpu}%` },
    { time: '08:00:02.502', level: 'WARN', message: `Database connection pool ${t.dbConnections}/100` },
    { time: '08:00:03.110', level: 'ERROR', message: 'Database connection timeout · pool exhausted' },
  );
  else rows.push({ time: '08:00:02.502', level: 'INFO', message: `Database connections ${t.dbConnections}/100 · within capacity` });
  if (t.apiCpu >= 95) rows.push({ time: '08:00:03.210', level: 'WARN', message: 'API workers saturated · requests waiting for compute' });
  rows.push({ time: '08:00:04.027', level: t.errorRate >= 1 ? 'ERROR' : 'INFO', message: `GET /balance ${t.errorRate >= 1 ? '503' : '200'} · p95 ${t.p95}ms · errors ${t.errorRate}%` });
  return rows;
}
export function generateTrace(apiQueue: number, dbQueue: number, cache: boolean, disconnected: boolean): TraceSpan[] {
  if (disconnected) return [{ name: 'API / routing', duration: 28, kind: 'compute' }, { name: 'Dependency timeout', duration: 1932, kind: 'data' }, { name: 'Other', duration: 40, kind: 'other' }];
  return [
    { name: 'API', duration: 28 + apiQueue, kind: 'compute' },
    { name: 'Authentication', duration: 12, kind: 'other' },
    ...(cache ? [{ name: 'Redis lookup', duration: 5, kind: 'cache' as const }] : []),
    { name: 'PostgreSQL', duration: 72 + dbQueue, kind: 'data' },
    { name: 'Serialization', duration: 8, kind: 'other' },
    { name: 'Network', duration: cache ? 20 : 25, kind: 'other' },
  ];
}
