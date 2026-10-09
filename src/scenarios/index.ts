import { doubleDebit } from './double-debit';
import { paydaySurge } from './payday-surge';
import type { ScenarioDefinition } from '../simulation/types';

export const scenarios: Record<string, ScenarioDefinition> = { [paydaySurge.id]: paydaySurge, [doubleDebit.id]: doubleDebit };
export const missionPreviews = [
  { id: paydaySurge.id, number: '01', title: paydaySurge.title, company: 'SwiftPay', topic: 'Capacity · Caching · Observability', available: true },
  { id: doubleDebit.id, number: '02', title: doubleDebit.title, company: 'SwiftPay', topic: 'Retries · Ledger · Idempotency', available: true },
  { id: 'missing-event', number: '03', title: 'Missing Event', company: 'SwiftPay', topic: 'Queues · Transactional outbox', available: false },
  { id: 'global-expansion', number: '04', title: 'Global Expansion', company: 'SwiftPay', topic: 'Regions · Replication', available: false },
];
