import type { MissionObjective } from '../simulation/types';

/** Sandbox workload shortcuts. Learners can still edit the numbers afterwards. */
export const workloadPresets = [
  { id: 'balance', label: 'Balance checks · 12k req/s · 90% reads', peak: 12000, readFraction: 0.9 },
  { id: 'feed', label: 'Social feed · 30k req/s · 98% reads', peak: 30000, readFraction: 0.98 },
  { id: 'checkout', label: 'Checkout · 6k req/s · 60% reads', peak: 6000, readFraction: 0.6 },
  { id: 'flash-sale', label: 'Flash sale · 8k req/s · 50% writes', peak: 8000, readFraction: 0.5 },
  { id: 'quiet', label: 'Quiet night · 1.2k req/s · 90% reads', peak: 1200, readFraction: 0.9 },
];

/** Open-ended design challenges: the workload and goals are fixed, the architecture is the learner's. */
export interface Challenge {
  id: string;
  title: string;
  prompt: string;
  peak: number;
  readFraction: number;
  budget: number;
  objectives: MissionObjective[];
}
const p95 = (target: number): MissionObjective => ({ id: 'p95', label: 'p95 latency', target, comparison: 'lt', unit: 'ms' });
const errors: MissionObjective = { id: 'errorRate', label: 'Error rate', target: 1, comparison: 'lt', unit: '%' };
const cost = (target: number): MissionObjective => ({ id: 'cost', label: 'Monthly cost', target, comparison: 'lte', unit: '$' });

export const challenges: Challenge[] = [
  {
    id: 'cost-cutter', title: 'Payday on a shoestring',
    prompt: 'Serve 12,000 balance requests per second with fresh balances for $1,300 a month or less.',
    peak: 12000, readFraction: 0.9, budget: 1300,
    objectives: [p95(300), errors, { id: 'incorrectBalances', label: 'Stale balance reads', target: 0, comparison: 'eq', unit: '/s' }, cost(1300)],
  },
  {
    id: 'url-shortener', title: 'Design a URL shortener',
    prompt: 'A link service handles 40,000 redirects per second; 99% are reads of popular links. Keep redirects fast within $3,000 a month.',
    peak: 40000, readFraction: 0.99, budget: 3000,
    objectives: [p95(200), errors, { id: 'dbCpu', label: 'Database CPU', target: 85, comparison: 'lt', unit: '%' }, cost(3000)],
  },
  {
    id: 'flash-sale', title: 'Survive a flash sale',
    prompt: 'Half of 8,000 requests per second are order writes. Protect the database and apply every queued write within a minute, for $2,500 or less.',
    peak: 8000, readFraction: 0.5, budget: 2500,
    objectives: [errors, { id: 'dbCpu', label: 'Database CPU', target: 90, comparison: 'lt', unit: '%' }, { id: 'asyncLag', label: 'Queued write delay', target: 60, comparison: 'lt', unit: ' s' }, cost(2500)],
  },
];
export const challengeById = (id: string | null | undefined) => challenges.find(item => item.id === id);
