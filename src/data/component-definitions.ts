import type { ArchitectureNode, ComponentDefinition, ComponentKind, NodeConfig } from '../simulation/types';

export const definitions: Record<ComponentKind, ComponentDefinition> = {
  users: {
    id: 'users', name: 'Customers', category: 'TRAFFIC', role: 'source', capacity: 12000, baseLatency: 0, vcpu: 0, memory: 0, monthlyCost: 0,
    description: 'Clients that send the workload. With several client sources, traffic is split evenly between them.', available: true,
  },
  'load-balancer': {
    id: 'load-balancer', name: 'Load Balancer', category: 'TRAFFIC', role: 'router', capacity: 50000, baseLatency: 5, vcpu: 2, memory: 2, monthlyCost: 80,
    description: 'Routes requests across connected API capacity and skips offline instances. Connect clients to application workers.', available: true,
  },
  'api-small': {
    id: 'api-small', name: 'API Server Small', category: 'COMPUTE', role: 'compute', capacity: 1500, baseLatency: 28, vcpu: 2, memory: 4, monthlyCost: 80,
    description: 'A small application worker. Scales compute, but cannot fix a saturated database.', available: true,
  },
  'api-medium': {
    id: 'api-medium', name: 'API Server Medium', category: 'COMPUTE', role: 'compute', capacity: 2500, baseLatency: 28, vcpu: 4, memory: 8, monthlyCost: 120,
    description: 'More application capacity. Cache hits also reduce time spent on expensive database work.', available: true,
  },
  worker: {
    id: 'worker', name: 'Background Worker', category: 'COMPUTE', role: 'consumer', capacity: 1200, baseLatency: 20, vcpu: 2, memory: 4, monthlyCost: 70,
    description: 'Consumes queued writes and applies them to a database. Add workers to drain a backlog faster.', available: true,
  },
  kubernetes: {
    id: 'kubernetes', name: 'Kubernetes', category: 'COMPUTE', role: 'design', capacity: 0, baseLatency: 0, vcpu: 0, memory: 0, monthlyCost: 0,
    description: 'Design preview: an orchestration boundary for workloads. Traffic drawn through it passes unchanged; scheduling, autoscaling, and recovery are not simulated, and it is unpriced.', available: false,
  },
  postgres: {
    id: 'postgres', name: 'PostgreSQL', category: 'DATA', role: 'database', capacity: 6000, readCapacity: 6000, writeCapacity: 3000, connectionLimit: 100, baseLatency: 72, vcpu: 8, memory: 32, monthlyCost: 600,
    description: 'The authoritative balance store. Writes cost twice as much as reads in this model.', available: true,
  },
  mysql: {
    id: 'mysql', name: 'MySQL', category: 'DATA', role: 'database', capacity: 6000, readCapacity: 6000, writeCapacity: 3000, connectionLimit: 100, baseLatency: 72, vcpu: 8, memory: 32, monthlyCost: 600,
    description: 'A relational primary database, modeled at the same instance size as PostgreSQL. Engine-specific behavior is not simulated.', available: true,
  },
  mongodb: {
    id: 'mongodb', name: 'MongoDB', category: 'DATA', role: 'database', capacity: 6000, readCapacity: 6000, writeCapacity: 3000, connectionLimit: 100, baseLatency: 72, vcpu: 8, memory: 32, monthlyCost: 600,
    description: 'A document database primary, modeled at the same instance size as PostgreSQL. Document design, sharding, and change streams are not simulated.', available: true,
  },
  redis: {
    id: 'redis', name: 'Redis Cache', category: 'DATA', role: 'cache', capacity: 30000, baseLatency: 5, vcpu: 2, memory: 4, monthlyCost: 180, cacheHitRate: 0.82,
    description: 'An in-memory cache. At the default 4 GB, 5-minute TTL, and invalidate-on-write it serves 82% of repeated reads. Misses and writes reach the database behind it.', available: true,
  },
  'read-replica': {
    id: 'read-replica', name: 'Read Replica', category: 'DATA', role: 'replica', capacity: 5000, readCapacity: 5000, connectionLimit: 100, baseLatency: 72, vcpu: 4, memory: 16, monthlyCost: 320,
    description: 'An asynchronous copy of a primary database. It serves reads and replays every write, so it lags behind. Wire primary → replica for replication and API → replica for reads.', available: true,
  },
  queue: {
    id: 'queue', name: 'RabbitMQ Queue', category: 'MESSAGING', role: 'queue', capacity: 20000, baseLatency: 8, vcpu: 1, memory: 2, monthlyCost: 80, maxQueueDepth: 500_000,
    description: 'A work queue. A write is acknowledged once queued; competing consumers apply it later. Publishes are rejected when 500,000 messages are waiting.', available: true,
  },
  kafka: {
    id: 'kafka', name: 'Apache Kafka', category: 'MESSAGING', role: 'queue', capacity: 20000, baseLatency: 8, vcpu: 2, memory: 4, monthlyCost: 160, maxQueueDepth: 50_000_000,
    description: 'A partitioned, durable log. Producers append writes; a consumer group reads them with at most one consumer per partition.', available: true,
  },
  outbox: {
    id: 'outbox', name: 'Transactional Outbox', category: 'RELIABILITY', role: 'design', capacity: 0, baseLatency: 0, vcpu: 0, memory: 0, monthlyCost: 0,
    description: 'Design preview: store an event in the same transaction as the data change. Traffic drawn through it passes unchanged; event delivery is not simulated, and it is unpriced.', available: false,
  },
  cdc: {
    id: 'cdc', name: 'Change Data Capture', category: 'RELIABILITY', role: 'design', capacity: 0, baseLatency: 0, vcpu: 0, memory: 0, monthlyCost: 0,
    description: 'Design preview: relay committed database changes to an event stream. Can represent an outbox relay instead of a polling worker. Delivery, offsets, and recovery are not simulated; cost is unpriced.', available: false,
  },
};
export const singletonKinds: ComponentKind[] = ['users', 'load-balancer', 'postgres', 'redis'];
export const isComponentKind = (value: string): value is ComponentKind => Object.hasOwn(definitions, value);

export const isApi = (kind: ComponentKind) => kind === 'api-small' || kind === 'api-medium';
export const roleOf = (node: Pick<ArchitectureNode, 'kind'>) => definitions[node.kind].role;

/** Memory sizes and monthly prices for Redis. 4 GB matches the original catalog price. */
export const redisMemoryOptions = [
  { gb: 1, monthlyCost: 60 },
  { gb: 2, monthlyCost: 100 },
  { gb: 4, monthlyCost: 180 },
  { gb: 8, monthlyCost: 340 },
];
export const redisTtlOptions = [
  { seconds: 10, label: '10 seconds' },
  { seconds: 60, label: '1 minute' },
  { seconds: 300, label: '5 minutes' },
  { seconds: 3600, label: '1 hour' },
];
export const kafkaPartitionOptions = [1, 3, 6, 12];

const defaultConfig: Partial<Record<ComponentKind, NodeConfig>> = {
  redis: { memoryGb: 4, ttlSeconds: 300, writePolicy: 'invalidate' },
  kafka: { partitions: 3 },
  'read-replica': { readYourWrites: false },
};
/** The node's settings with defaults applied. Stored config only holds explicit learner choices. */
export const nodeConfig = (node: Pick<ArchitectureNode, 'kind' | 'config'>): NodeConfig => ({ ...defaultConfig[node.kind], ...node.config });
export const isConfigurable = (kind: ComponentKind) => kind in defaultConfig;
