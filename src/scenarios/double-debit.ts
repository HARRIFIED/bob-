import type { ScenarioDefinition } from '../simulation/types';
import { paydaySurge } from './payday-surge';

export const doubleDebit: ScenarioDefinition = {
  id: 'double-debit', number: '02', incidentId: 'INC–002', engine: 'transfers',
  title: 'Double Debit', company: 'SwiftPay', budget: 1500,
  description: 'The transfer service looks healthy, but customers report being charged twice. PostgreSQL commits a transfer before a network timeout hides the response. The mobile client retries on another API worker. Did the first transfer fail, or did only its acknowledgement go missing?',
  presentation: {
    subtitle: 'One transfer. Two debits. Healthy dashboards can hide a correctness incident.',
    supportQuote: 'I sent ₦5,000 once. The app timed out, then my balance dropped by ₦10,000.',
    symptoms: 'Lost acknowledgements · Automatic retries · Duplicate ledger entries',
    infrastructure: 'Retrying client → load balancer → 2 API workers → PostgreSQL',
    missionTitle: 'One intent. One debit.', loadLabel: 'STEADY TRAFFIC',
    loadDescription: 'Steady load · scripted retry incident',
    correctnessNote: 'Model: transfer code runs inside API workers. A unique account/key, debit, and saved response commit atomically in PostgreSQL lookup mode.',
    learningTip: 'A timeout says the client did not receive a response. It does not prove the database rolled back. Follow the request key and receipt in Ledger.',
    completionText: 'Retries return the original receipts. Each intended transfer debits the account exactly once.',
    requestMethod: 'POST', requestPath: '/transfers', initialTab: 'Ledger',
  },
  initialArchitecture: {
    nodes: paydaySurge.initialArchitecture.nodes.map(node => node.kind === 'users'
      ? { ...node, position: { ...node.position }, label: 'Mobile Clients', retryPolicy: { enabled: true, keyStrategy: 'same-key' as const } }
      : { ...node, position: { ...node.position } }),
    edges: paydaySurge.initialArchitecture.edges.map(edge => ({ ...edge })),
  },
  trafficProfile: { normal: 1200, peak: 1200, readFraction: 0, writeWeight: 2, ramp: [1, 1, 1, 1, 1, 1] },
  model: { ...paydaySurge.model },
  transfers: {
    account: 'Ada · wallet-017', currency: 'NGN', openingBalanceMinor: 5_000_000, timeoutMs: 1500,
    intents: [
      { id: 'transfer-1042', key: 'pay-1042', recipient: 'Tunde', amountMinor: 500_000 },
      { id: 'transfer-1043', key: 'pay-1043', recipient: 'Maya', amountMinor: 200_000 },
      { id: 'transfer-1044', key: 'pay-1044', recipient: 'Efe', amountMinor: 300_000 },
    ],
    attempts: [
      { id: 'req-001', transferId: 'transfer-1042', attempt: 1, phase: 1, time: '09:15:00.100', responseLost: true },
      { id: 'req-002', transferId: 'transfer-1042', attempt: 2, phase: 2, time: '09:15:01.600', responseLost: false },
      { id: 'req-003', transferId: 'transfer-1043', attempt: 1, phase: 3, time: '09:15:02.000', responseLost: false },
      { id: 'req-004', transferId: 'transfer-1044', attempt: 1, phase: 4, time: '09:15:03.000', responseLost: true },
      { id: 'req-005', transferId: 'transfer-1044', attempt: 2, phase: 5, time: '09:15:04.500', responseLost: false, restartWorker: true },
    ],
  },
  objectives: [
    { id: 'duplicateDebits', label: 'Duplicate debits', target: 0, comparison: 'eq', unit: '' },
    { id: 'incorrectBalances', label: 'Incorrect balances', target: 0, comparison: 'eq', unit: '' },
    { id: 'completionRate', label: 'Transfers confirmed', target: 100, comparison: 'eq', unit: '%' },
    { id: 'p95', label: 'Accepted request p95', target: 300, comparison: 'lt', unit: 'ms' },
    { id: 'cost', label: 'Monthly cost', target: 1500, comparison: 'lte', unit: '$' },
  ],
  scriptedEvents: [
    { phase: 'Opening the ledger', message: 'Three intended transfers. No money has moved yet' },
    { phase: 'Commit, then silence', message: 'The first debit commits; its response is lost' },
    { phase: 'Client retries', message: 'The same transfer reaches another API worker' },
    { phase: 'A different transfer', message: 'A new intent needs its own key and its own debit' },
    { phase: 'Another lost response', message: 'A second committed transfer hits the same network fault' },
    { phase: 'Reconcile the account', message: 'A worker restarts; retry and reconcile the stored responses' },
  ],
  mentorRules: {
    brief: { id: 'brief', text: 'The graphs look calm, but Ada’s balance is wrong. Reproduce the timeout and follow the ledger. A missing response is not the same as a failed transfer.' },
    initial: { id: 'initial', text: 'Run the baseline. Watch the first commit, the lost response, and the retry. Then compare the number of intended transfers with the actual debits.' },
    duplicate: { id: 'duplicate', text: 'The client retried an already committed transfer. Each retry created a new receipt and another debit. More API capacity cannot tell the server which requests are the same intent.' },
    newKey: { id: 'newKey', text: 'The API looks up request keys, but each retry has a fresh key. The server sees a new operation. Keep the original key for retries of the same transfer; use a new key for a different transfer.' },
    missingKey: { id: 'missingKey', text: 'The requests have no Idempotency-Key header. The API cannot use a key lookup to recognize a repeat. Compare the request headers and payloads in Ledger.' },
    workerMemory: { id: 'workerMemory', text: 'Each worker only remembers its own requests. Another worker cannot find that response, and a restart clears local memory. The debit survives in PostgreSQL, so the next lookup can miss and debit again.' },
    cacheOnly: { id: 'cacheOnly', text: 'Redis is serving as a read cache. These requests are transfer writes, so they still reach PostgreSQL and debit again. Inspect what the API does with the request key.' },
    unconfirmed: { id: 'unconfirmed', text: 'Removing retries hid the extra debit, but customers still cannot confirm the transfers whose responses were lost. Keep retries and make them safe.' },
    disconnected: { id: 'disconnected', text: 'A transfer could not reach the ledger. Check the load balancer, API, Redis path if used, and PostgreSQL connections. No duplicate debit is not enough if the transfer never completes.' },
    conflict: { id: 'conflict', text: 'One key was reused with different transfer parameters. The API rejected it instead of replaying an unrelated receipt. Distinct intents need distinct keys.' },
    budget: { id: 'budget', text: 'The ledger is correct, but the system is over budget. Extra servers did not solve this incident. Remove unused capacity and rerun.' },
    compute: { id: 'compute', text: 'The retry policy is safe, but processing latency misses the target. Check application capacity before the next run.' },
    pending: { id: 'pending', text: 'The replay is still in progress. Wait for both retries before judging correctness.' },
    success: { id: 'success', text: 'Three intended transfers, three debits. Both retries returned their original receipts, including after the worker restart, and Ada’s balance matches the ledger. That is safe retry behavior.' },
  },
  explanations: {
    worked: 'Each logical transfer kept the same idempotency key across retries. The API used the request header to look up a shared transfer record. A unique account/key, debit, and response were persisted atomically in PostgreSQL. A retry after a worker change or restart returned that saved response instead of posting another debit. Different transfer keys still created separate transfers.',
    tradeoff: 'Idempotency adds a lookup, durable key storage, and lifecycle decisions. Keys must be scoped to a caller and bound to the request parameters. This mission assumes atomic transactions and keys retained throughout the retry window; a worker restart clears local memory but preserves committed records. Concurrent transaction interleaving, mid-commit crashes, key expiry, and external payment side effects are not modeled. Delivery is still repeated—the ledger effect happens once.',
  },
};
