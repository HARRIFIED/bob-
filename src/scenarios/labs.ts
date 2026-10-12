import type { GuideKey } from '../learning/component-guides';
import type { ArchitectureNode, ArchitectureState, ComponentKind, MentorMessage, MissionObjective, ScenarioDefinition } from '../simulation/types';
import { capacityMentorRules } from './capacity-mentor';
import { paydaySurge } from './payday-surge';
import { setNodeFault } from '../simulation/architecture';

export interface LabQuiz { question: string; choices: string[]; answer: number; explanation: string }
export interface Lab {
  id: string;
  component: GuideKey;
  title: string;
  /** One line for lab cards. */
  summary: string;
  minutes: number;
  /** Suggested experiment steps. Guidance only: success is measured, never a fixed graph. */
  steps: string[];
  quiz: LabQuiz;
  scenario: ScenarioDefinition;
}

type NodeSpec = [id: string, kind: ComponentKind, label: string, x: number, y: number, extra?: Pick<ArchitectureNode, 'config' | 'fault'>];
function build(nodes: NodeSpec[], edges: [string, string][]): ArchitectureState {
  return {
    nodes: nodes.map(([id, kind, label, x, y, extra]) => ({ id, kind, label, position: { x, y }, added: false, ...extra })),
    edges: edges.map(([source, target]) => ({ id: `${source}-${target}`, source, target })),
  };
}
/** Clients → load balancer → medium API instances, laid out like the mission boards. */
function front(count: number): { nodes: NodeSpec[]; edges: [string, string][]; ids: string[] } {
  const ids = Array.from({ length: count }, (_, index) => `api-${index + 1}`);
  const top = 125 - (count - 1) * 105;
  return {
    ids,
    nodes: [
      ['users', 'users', 'Customers', 0, 125],
      ['lb', 'load-balancer', 'Load Balancer', 240, 125],
      ...ids.map((id, index): NodeSpec => [id, 'api-medium', `API Server ${String(index + 1).padStart(2, '0')}`, 480, top + index * 210]),
    ],
    edges: [['users', 'lb'], ...ids.map((id): [string, string] => ['lb', id])],
  };
}
const fan = (ids: string[], target: string) => ids.map((id): [string, string] => [id, target]);

const objective = {
  p95: (target: number): MissionObjective => ({ id: 'p95', label: 'p95 latency', target, comparison: 'lt', unit: 'ms' }),
  errors: (): MissionObjective => ({ id: 'errorRate', label: 'Error rate', target: 1, comparison: 'lt', unit: '%' }),
  cost: (target: number): MissionObjective => ({ id: 'cost', label: 'Monthly cost', target, comparison: 'lte', unit: '$' }),
  dbCpu: (target: number): MissionObjective => ({ id: 'dbCpu', label: 'Database CPU', target, comparison: 'lt', unit: '%' }),
  hitRate: (target: number): MissionObjective => ({ id: 'cacheHitRate', label: 'Cache hit rate', target, comparison: 'gte', unit: '%' }),
  fresh: (): MissionObjective => ({ id: 'incorrectBalances', label: 'Stale balance reads', target: 0, comparison: 'eq', unit: '/s' }),
  asyncLag: (target: number): MissionObjective => ({ id: 'asyncLag', label: 'Queued write delay', target, comparison: 'lt', unit: ' s' }),
};

interface LabSpec extends Omit<Lab, 'scenario'> {
  goal: string;
  brief: string;
  traffic: number;
  readFraction: number;
  budget: number;
  objectives: MissionObjective[];
  architecture: ArchitectureState;
  mentor?: Record<string, string>;
  worked: string;
  tradeoff: string;
}
function lab(spec: LabSpec): Lab {
  const { goal, brief, traffic, readFraction, budget, objectives, architecture, mentor = {}, worked, tradeoff, ...meta } = spec;
  const overrides = Object.fromEntries(Object.entries(mentor).map(([id, text]): [string, MentorMessage] => [id, { id, text }]));
  const scenario: ScenarioDefinition = {
    id: `lab-${spec.id}`, title: spec.title, company: 'Component Labs', description: brief,
    engine: 'capacity', number: 'LAB', incidentId: `LAB / ${spec.id.toUpperCase()}`,
    initialArchitecture: architecture,
    presentation: {
      subtitle: spec.summary, supportQuote: '', symptoms: '', infrastructure: '',
      missionTitle: goal, loadLabel: 'LAB LOAD',
      loadDescription: `${Math.round(readFraction * 100)}% reads · ${traffic.toLocaleString('en-US')} req/s`,
      correctnessNote: 'Lab model: requests follow your connections. Values are simplified teaching estimates.',
      learningTip: brief, completionText: worked,
      requestMethod: 'GET', requestPath: '/balance', initialTab: 'Metrics',
    },
    trafficProfile: { normal: traffic * 0.1, peak: traffic, readFraction, writeWeight: 2, ramp: [0.1, 0.28, 0.5, 0.72, 0.9, 1] },
    budget, objectives,
    scriptedEvents: [
      { phase: 'Warming up', message: 'Starting at 10% of the lab load' },
      { phase: 'Ramping traffic', message: 'Traffic is climbing' },
      { phase: 'Halfway', message: 'Watching the busiest component' },
      { phase: 'Under pressure', message: 'Measuring queues and dependencies' },
      { phase: 'Collecting evidence', message: 'Capturing logs and a sample trace' },
      { phase: 'Full load', message: 'Checking the lab goals' },
    ],
    mentorRules: { ...capacityMentorRules, initial: { id: 'initial', text: brief }, ...overrides },
    model: { ...paydaySurge.model },
    explanations: { worked, tradeoff },
  };
  return { ...meta, scenario };
}

const scaleOut = (() => {
  const base = front(1);
  return lab({
    id: 'scale-out', component: 'api-medium', title: 'Scale out the API tier', minutes: 4,
    summary: 'One API instance cannot keep up. Add capacity behind the load balancer.',
    goal: 'Serve 5,000 req/s on a $1,000 budget.',
    brief: 'One API instance is serving 5,000 requests per second. Run it, find the busy component, then add capacity behind the load balancer.',
    traffic: 5000, readFraction: 0.9, budget: 1000,
    objectives: [objective.p95(250), objective.errors(), objective.cost(1000)],
    architecture: build([...base.nodes, ['db', 'postgres', 'PostgreSQL', 780, 125]], [...base.edges, ...fan(base.ids, 'db')]),
    steps: ['Run the baseline and compare API CPU with database CPU.', 'Add an API instance and connect load balancer → API → PostgreSQL.', 'Rerun and check the budget. Small instances are cheaper.'],
    mentor: { compute: 'API CPU is pinned. Every request waits for one instance. Add capacity behind the load balancer and connect it to PostgreSQL.' },
    quiz: { question: 'Two instances share the traffic. What happens to each instance’s load?', choices: ['It stays the same', 'It roughly halves', 'It doubles'], answer: 1, explanation: 'The load balancer spreads requests by capacity, so each instance does part of the work.' },
    worked: 'More instances behind the load balancer shared the requests, so no instance queued work.',
    tradeoff: 'Horizontal scaling only helps while dependencies have headroom. Each instance also adds cost.',
  });
})();

const surviveFailure = (() => {
  const base = front(2);
  const architecture = build([...base.nodes, ['db', 'postgres', 'PostgreSQL', 780, 125]], [...base.edges, ...fan(base.ids, 'db')]);
  return lab({
    id: 'survive-failure', component: 'load-balancer', title: 'Survive an instance failure', minutes: 4,
    summary: 'One of two API instances is down. Keep serving with N+1 capacity.',
    goal: 'Stay healthy with one instance offline.',
    brief: 'API Server 02 just went offline. The load balancer skips it, so API Server 01 now carries everything. Can your design absorb a failure?',
    traffic: 4000, readFraction: 0.9, budget: 1100,
    objectives: [objective.p95(300), objective.errors(), objective.cost(1100)],
    architecture: setNodeFault(architecture, 'api-2', 'down'),
    steps: ['Run with the failed instance and inspect the survivor’s CPU.', 'Add a spare instance and wire it like the others.', 'Rerun: the outage is still there, but now you have headroom.'],
    mentor: { compute: 'The surviving instance is overloaded. Redundancy means enough spare capacity to lose one instance and still serve the load.' },
    quiz: { question: 'What does “N+1” capacity mean?', choices: ['One extra instance beyond what the load needs', 'Adding one server per incident', 'Running one instance per user'], answer: 0, explanation: 'With N+1, losing any single instance still leaves enough capacity for the load.' },
    worked: 'The spare instance gave the load balancer somewhere healthy to send traffic while one instance was down.',
    tradeoff: 'Spare capacity costs money while idle. The load balancer itself can also fail; production systems run more than one.',
  });
})();

/** Four APIs behind Redis and PostgreSQL, with optional starting cache settings or fault. */
const cachedFront = (redis: Pick<ArchitectureNode, 'config' | 'fault'> = {}) => {
  const base = front(4);
  return build(
    [...base.nodes, ['redis', 'redis', 'Redis Cache', 780, 125, redis], ['db', 'postgres', 'PostgreSQL', 1060, 125]],
    [...base.edges, ...fan(base.ids, 'redis'), ['redis', 'db']],
  );
};

const redisShield = (() => {
  const base = front(4);
  return lab({
    id: 'redis-shield', component: 'redis', title: 'Shield the database', minutes: 5,
    summary: 'Repeated reads are crushing PostgreSQL. Put a cache in front of it.',
    goal: 'Keep database CPU under 75%.',
    brief: 'Ninety-five percent of these requests read the same balances again and again. PostgreSQL answers every one. Find the bottleneck, then cache it.',
    traffic: 8000, readFraction: 0.95, budget: 1400,
    objectives: [objective.dbCpu(75), objective.p95(200), objective.errors(), objective.cost(1400)],
    architecture: build([...base.nodes, ['db', 'postgres', 'PostgreSQL', 1060, 125]], [...base.edges, ...fan(base.ids, 'db')]),
    steps: ['Run and open Traces: where does the slow request wait?', 'Add Redis Cache. Connect each API → Redis and Redis → PostgreSQL.', 'Rerun and compare database CPU and the cache hit rate.'],
    quiz: { question: 'Why does a cache lower database CPU?', choices: ['It makes queries faster', 'Repeated reads are answered before they reach the database', 'It deletes old data'], answer: 1, explanation: 'Each cache hit is a read the database never sees. Writes and misses still reach it.' },
    worked: 'Redis answered most repeated reads, so PostgreSQL only handled misses and writes.',
    tradeoff: 'A cache adds cost and a freshness problem: cached values must be invalidated when the data changes.',
  });
})();

const redisSizing = lab({
  id: 'redis-sizing', component: 'redis', title: 'Right-size the cache', minutes: 4,
  summary: 'An 8 GB cache blows the budget. Find the smallest size that still protects the database.',
  goal: 'Protect the database on a $1,300 budget.',
  brief: 'Someone provisioned an 8 GB cache “to be safe”. The hot data is about 4 GB, and the budget is $1,300. How small can the cache be before PostgreSQL suffers?',
  traffic: 10000, readFraction: 0.95, budget: 1300,
  objectives: [objective.dbCpu(80), objective.p95(200), objective.errors(), objective.cost(1300)],
  architecture: cachedFront({ config: { memoryGb: 8 } }),
  steps: ['Run the oversized cache and note the hit rate and cost.', 'Select Redis and lower its memory one step at a time.', 'Rerun after each change. Stop when the database still has headroom.'],
  mentor: { budget: 'The cache works, but you pay for memory the hot data does not need. Try a smaller size and measure the hit rate.' },
  quiz: { question: 'Halving cache memory roughly…', choices: ['Halves the hit rate', 'Lowers it less than half, because popular keys get most reads', 'Has no effect'], answer: 1, explanation: 'Reads cluster on popular keys. A smaller cache still holds the hottest ones, until it gets too small.' },
  worked: 'The smallest cache that kept the hottest keys still absorbed enough reads to keep the database healthy.',
  tradeoff: 'Sizing to today’s hot data leaves little room for growth. Production caches keep headroom and monitor eviction rates.',
});

const redisFreshness = lab({
  id: 'redis-freshness', component: 'redis', title: 'Fresh balances, warm cache', minutes: 5,
  summary: 'The cache is fast but shows old balances. Keep it warm and correct.',
  goal: 'High hit rate, zero stale balances.',
  brief: 'This cache keeps balances for an hour and never invalidates them. It is fast, but customers see their old balance after a transfer. Fix freshness without losing the hit rate.',
  traffic: 8000, readFraction: 0.9, budget: 1400,
  objectives: [objective.fresh(), objective.hitRate(80), objective.p95(200), objective.errors()],
  architecture: cachedFront({ config: { ttlSeconds: 3600, writePolicy: 'ttl-only' } }),
  steps: ['Run and read the stale-read warning in Logs.', 'Try a shorter TTL and rerun. What happens to the hit rate?', 'Change the write policy so writes invalidate cached balances.'],
  mentor: { stale: 'Customers read balances that miss their own transfers. The cache keeps old values until they expire. Shortening the TTL trades hits for freshness; what else could remove the stale value?' },
  quiz: { question: 'Why can’t a short TTL alone fix read-your-writes?', choices: ['A read right after the write can still hit the old cached value', 'Short TTLs make writes slower', 'Redis ignores short TTLs'], answer: 0, explanation: 'Until it expires, the old value is still served. Invalidating on write removes it immediately.' },
  worked: 'Invalidating on write removed the old value the moment a balance changed, so a long TTL could keep the cache warm safely.',
  tradeoff: 'Invalidation must happen on every write path. A missed path, or a race between a write and a refill, can still leave old data.',
});

const redisColdStart = lab({
  id: 'redis-cold-start', component: 'redis', title: 'Survive a cold cache', minutes: 6,
  summary: 'Redis restarted empty. The miss stampede hits PostgreSQL at full load.',
  goal: 'Keep serving while the cache is cold.',
  brief: 'Redis just restarted with an empty memory. Almost every read misses and goes straight to PostgreSQL at full payday load. Give the data tier enough headroom to survive it.',
  traffic: 12000, readFraction: 0.9, budget: 2100,
  objectives: [objective.errors(), objective.p95(300), objective.cost(2100)],
  architecture: cachedFront({ fault: 'cold' }),
  steps: ['Run and compare the cache hit rate with database CPU.', 'Add read capacity behind Redis: read replicas (wire primary → replica) or a second database.', 'Rerun and check errors and cost.'],
  mentor: { database: 'The cold cache sends nearly every read to PostgreSQL. Adding API instances will not help. Where else could cache misses be answered?' },
  quiz: { question: 'Why is a cache flush dangerous at peak load?', choices: ['Redis gets slower', 'Every miss reaches the database at once', 'Writes stop working'], answer: 1, explanation: 'A design that relies on the cache must survive it being empty. Misses arrive together, as a stampede.' },
  worked: 'Extra read capacity behind the cache absorbed the miss stampede until the cache could warm up.',
  tradeoff: 'Headroom for a cold cache costs money every day. Teams also warm caches before traffic or limit concurrent refills.',
});

const replicaOffload = (() => {
  const base = front(4);
  return lab({
    id: 'replica-offload', component: 'read-replica', title: 'Offload reads to a replica', minutes: 5,
    summary: 'PostgreSQL is saturated by reads. Add a read replica to share them.',
    goal: 'Bring primary database CPU under 85%.',
    brief: 'PostgreSQL is answering every read and every write. A read replica can take part of the reads, but it must replicate from the primary.',
    traffic: 9000, readFraction: 0.95, budget: 1500,
    objectives: [objective.dbCpu(85), objective.p95(300), objective.errors(), objective.cost(1500)],
    architecture: build([...base.nodes, ['db', 'postgres', 'PostgreSQL', 780, 125]], [...base.edges, ...fan(base.ids, 'db')]),
    steps: ['Run and confirm the primary is the bottleneck.', 'Add a Read Replica. Connect PostgreSQL → replica, then each API → replica.', 'Rerun. Compare primary CPU, replica lag, and stale reads.'],
    mentor: { replica: 'The replica is overloaded. It answers reads and also replays every write from the primary.' },
    quiz: { question: 'A replica copies the primary asynchronously. What is the risk?', choices: ['It can return data that is slightly behind', 'It can corrupt the primary', 'It doubles write latency'], answer: 0, explanation: 'Replication lag means a replica can serve values the primary has already changed.' },
    worked: 'The replica answered part of the reads, so the primary had room for writes and the remaining reads.',
    tradeoff: 'Replicas lag behind the primary and replay every write. Measure stale reads before routing customer-facing reads to them.',
  });
})();

const replicaReadYourWrites = (() => {
  const base = front(4);
  return lab({
    id: 'replica-read-your-writes', component: 'read-replica', title: 'Read your own writes', minutes: 4,
    summary: 'Customers sometimes see their balance without their own transfer.',
    goal: 'Zero stale balances, primary under 85%.',
    brief: 'The replica is helping capacity, but a customer who transfers money and checks right away can read a balance the replica has not caught up on.',
    traffic: 9000, readFraction: 0.95, budget: 1500,
    objectives: [objective.fresh(), objective.dbCpu(85), objective.p95(300), objective.errors()],
    architecture: build(
      [...base.nodes, ['db', 'postgres', 'PostgreSQL', 780, 20], ['replica', 'read-replica', 'Read Replica', 780, 240]],
      [...base.edges, ...fan(base.ids, 'db'), ...fan(base.ids, 'replica'), ['db', 'replica']],
    ),
    steps: ['Run and find the stale-read warning in Logs.', 'Select the Read Replica and turn on read-your-writes routing.', 'Rerun and check that the primary still has headroom.'],
    mentor: { stale: 'A customer’s follow-up read can land on the lagging replica. Route those reads to the primary; other reads can stay on the replica.' },
    quiz: { question: 'Read-your-writes routing sends which reads to the primary?', choices: ['All reads', 'A customer’s reads shortly after their own write', 'Only failed reads'], answer: 1, explanation: 'Only the reads that must reflect the customer’s change go to the primary, so most reads still use the replica.' },
    worked: 'Follow-up reads went to the primary, which already had the write. Everything else stayed on the replica.',
    tradeoff: 'The primary now carries those reads. Routing needs to know who wrote recently, often with a session flag or timestamp.',
  });
})();

const queueAbsorb = (() => {
  const base = front(4);
  return lab({
    id: 'queue-absorb', component: 'queue', title: 'Absorb a write spike', minutes: 6,
    summary: 'Half the traffic is writes. Queue them so the database is not overwhelmed.',
    goal: 'Protect the database; apply writes within 2 minutes.',
    brief: 'A flash sale doubled the writes. PostgreSQL cannot take them all at once. A queue can acknowledge writes now and let background workers apply them at a pace the database can absorb.',
    traffic: 6000, readFraction: 0.5, budget: 1500,
    objectives: [objective.dbCpu(90), objective.errors(), objective.p95(200), objective.asyncLag(120)],
    architecture: build([...base.nodes, ['db', 'postgres', 'PostgreSQL', 1060, 125]], [...base.edges, ...fan(base.ids, 'db')]),
    steps: [
      'Run and confirm writes overload PostgreSQL.',
      'Add a RabbitMQ Queue and a Background Worker. Connect each API → queue, queue → worker, worker → PostgreSQL.',
      'Rerun. Watch database CPU and the queued write delay. More workers drain faster but load the database.',
    ],
    mentor: {
      backlog: 'The queue is protecting the database, and writes are waiting. Is the delay within the goal? More workers drain faster, but they also send writes to PostgreSQL faster.',
      database: 'PostgreSQL is still overloaded. Writes reaching it directly, or too many workers draining the queue, both add load.',
    },
    quiz: { question: 'A queue in front of a database mainly…', choices: ['Removes database work', 'Spreads the same work over time', 'Makes reads faster'], answer: 1, explanation: 'Every queued write is still applied eventually. The queue controls when, which protects the database during a spike.' },
    worked: 'Writes were acknowledged once queued, and the worker applied them at a rate PostgreSQL could absorb.',
    tradeoff: 'Queued writes apply later, so readers can see old data in the meantime. A sustained overload still grows the backlog without limit.',
  });
})();

const kafkaPartitions = (() => {
  const base = front(4);
  const workers = ['worker-1', 'worker-2', 'worker-3'];
  return lab({
    id: 'kafka-partitions', component: 'kafka', title: 'Partitions cap parallelism', minutes: 4,
    summary: 'Three workers, one partition. Only one of them is doing anything.',
    goal: 'Apply queued writes within 5 seconds.',
    brief: 'Writes go through a Kafka topic to three background workers, yet the backlog keeps growing. Find out why the extra workers are idle.',
    traffic: 6000, readFraction: 0.6, budget: 2000,
    objectives: [objective.asyncLag(5), objective.dbCpu(90), objective.errors(), objective.p95(200)],
    architecture: build(
      [
        ...base.nodes,
        ['redis', 'redis', 'Redis Cache', 780, 20], ['kafka', 'kafka', 'Apache Kafka', 780, 290, { config: { partitions: 1 } }],
        ...workers.map((id, index): NodeSpec => [id, 'worker', `Worker ${String(index + 1).padStart(2, '0')}`, 1040, 110 + index * 180]),
        ['db', 'postgres', 'PostgreSQL', 1320, 125],
      ],
      [...base.edges, ...fan(base.ids, 'redis'), ...fan(base.ids, 'kafka'), ['redis', 'db'], ...workers.map((id): [string, string] => ['kafka', id]), ...fan(workers, 'db')],
    ),
    steps: ['Run and compare each worker’s load.', 'Select Kafka and raise the partition count.', 'Rerun and check the queued write delay.'],
    mentor: { stale: 'Writes wait in Kafka for a long time, so balances lag behind. Check Logs: how many consumers actually receive messages?' },
    quiz: { question: 'A consumer group has 3 workers and 1 partition. How many receive messages?', choices: ['3', '1', '0'], answer: 1, explanation: 'Within a consumer group, each partition is read by one consumer. Extra consumers wait until there are more partitions.' },
    worked: 'More partitions let each worker in the consumer group take a share of the messages.',
    tradeoff: 'Ordering is only guaranteed within a partition, and partition counts are hard to reduce later. Choose keys and counts deliberately.',
  });
})();

/** The Component Labs path, in suggested order. */
export const labs: Lab[] = [
  scaleOut, surviveFailure, redisShield, redisSizing, redisFreshness, redisColdStart,
  replicaOffload, replicaReadYourWrites, queueAbsorb, kafkaPartitions,
];
export const labById = (id: string | null) => labs.find(item => item.id === id);
export const labsFor = (component: GuideKey) => labs.filter(item => item.component === component);
