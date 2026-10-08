import type { ScenarioDefinition } from '../simulation/types';

export const paydaySurge: ScenarioDefinition = {
  id: 'payday-surge', title: 'Payday Surge', company: 'SwiftPay',
  description: 'It’s 08:00 on payday. Traffic is ten times normal. Customers are reporting slow balance checks, failed requests, and intermittent errors. You’re on call.',
  budget: 1500,
  trafficProfile: { normal: 1200, peak: 12000, readFraction: 0.9, writeWeight: 2, ramp: [0.1, 0.28, 0.5, 0.72, 0.9, 1] },
  model: { apiCacheRelief: 0.4, baseP95: 145, maxApiQueue: 320, maxDbQueue: 362, apiQueueFactor: 260, dbQueueFactor: 360 },
  initialArchitecture: {
    nodes: [
      { id: 'users', kind: 'users', label: 'Customers', position: { x: 0, y: 125 }, added: false },
      { id: 'lb', kind: 'load-balancer', label: 'Load Balancer', position: { x: 240, y: 125 }, added: false },
      { id: 'api-1', kind: 'api-medium', label: 'API Server 01', position: { x: 480, y: 20 }, added: false },
      { id: 'api-2', kind: 'api-medium', label: 'API Server 02', position: { x: 480, y: 230 }, added: false },
      { id: 'db', kind: 'postgres', label: 'PostgreSQL', position: { x: 780, y: 125 }, added: false },
    ],
    edges: [
      { id: 'users-lb', source: 'users', target: 'lb' },
      { id: 'lb-api-1', source: 'lb', target: 'api-1' }, { id: 'lb-api-2', source: 'lb', target: 'api-2' },
      { id: 'api-1-db', source: 'api-1', target: 'db' }, { id: 'api-2-db', source: 'api-2', target: 'db' },
    ],
  },
  objectives: [
    { id: 'p95', label: 'p95 latency', target: 300, comparison: 'lt', unit: 'ms' },
    { id: 'errorRate', label: 'Error rate', target: 1, comparison: 'lt', unit: '%' },
    { id: 'incorrectBalances', label: 'Incorrect balances', target: 0, comparison: 'eq', unit: '' },
    { id: 'availability', label: 'Availability', target: 99.9, comparison: 'gte', unit: '%' },
    { id: 'cost', label: 'Monthly cost', target: 1500, comparison: 'lte', unit: '$' },
  ],
  scriptedEvents: [
    { phase: 'Establishing baseline', message: 'Normal traffic · 1,200 requests/sec' },
    { phase: 'Payday begins', message: 'Customers are opening the app' },
    { phase: 'Ramping traffic', message: 'Inspecting application capacity' },
    { phase: 'Checking dependencies', message: 'Measuring database pressure' },
    { phase: 'Collecting telemetry', message: 'Capturing logs and a sample trace' },
    { phase: 'Peak traffic', message: 'Evaluating mission requirements' },
  ],
  mentorRules: {
    brief: { id: 'brief', text: 'It’s payday. Support says customers cannot reliably check their balances. Don’t start adding servers yet. Open production and find out what is actually failing.' },
    initial: { id: 'initial', text: 'Run the traffic before changing anything. Production should tell us where the problem is.' },
    database: { id: 'database', text: 'PostgreSQL is at 97% CPU and the connection pool is full. Open the trace: where is the request spending its time?' },
    computeOnly: { id: 'computeOnly', text: 'You added more compute, but PostgreSQL is still saturated. Are we solving the bottleneck or only increasing the bill?' },
    cacheAdded: { id: 'cacheAdded', text: 'Repeated balance reads can now be served from cache. Run the traffic again and inspect the database. Keep an eye on API capacity, too.' },
    compute: { id: 'compute', text: 'The database has breathing room, but the API layer is still overloaded. Compare incoming traffic with the combined capacity of your workers.' },
    disconnected: { id: 'disconnected', text: 'There’s a broken request path. Check the connections from customers through the load balancer and APIs to PostgreSQL. An unconnected component cannot serve traffic.' },
    budget: { id: 'budget', text: 'Performance looks good, but this design is over budget. Find capacity you can remove while keeping the system stable.' },
    success: { id: 'success', text: 'The system now meets the performance, correctness, and budget targets. Nice work. Let’s look at why this design holds up.' },
  },
  explanations: {
    worked: 'Horizontal API scaling increased application capacity, while Redis absorbed repeated balance reads. That reduced pressure on PostgreSQL and kept the connection pool from becoming saturated.',
    tradeoff: 'Caching adds infrastructure cost and a cache invalidation problem. This mission assumes writes update PostgreSQL and invalidate the corresponding cached balance. A real system must verify that policy under concurrency and failure.',
  },
};
export const missionPreviews = [
  { number: '01', title: 'Payday Surge', company: 'SwiftPay', topic: 'Capacity · Caching · Observability', available: true },
  { number: '02', title: 'Double Debit', company: 'SwiftPay', topic: 'Retries · Idempotency', available: false },
  { number: '03', title: 'Missing Event', company: 'SwiftPay', topic: 'Queues · Transactional outbox', available: false },
  { number: '04', title: 'Global Expansion', company: 'SwiftPay', topic: 'Regions · Replication', available: false },
];
