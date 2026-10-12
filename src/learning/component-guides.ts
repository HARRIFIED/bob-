import type { ComponentKind } from '../simulation/types';

export interface GuideLink { label: string; url: string }
export interface ComponentGuide {
  /** Short display name used in guide titles and lab cards. */
  title: string;
  summary: string;
  /** Bob's plain-language analogy. */
  analogy: string;
  useWhen: string[];
  avoidWhen: string[];
  /** What a learner can change in Bob, in the model's own terms. */
  tryInBob: string[];
  failureModes: string[];
  /** What the simulator models and what it leaves out. */
  modelNote: string;
  reading: GuideLink[];
}

/** API sizes share one guide; every other kind has its own. */
export type GuideKey = Exclude<ComponentKind, 'api-small'>;
export const guideKeyFor = (kind: ComponentKind): GuideKey => kind === 'api-small' ? 'api-medium' : kind;

/** Field Guide content. External links are references opened by the learner; the app never fetches them. */
export const componentGuides: Record<GuideKey, ComponentGuide> = {
  users: {
    title: 'Clients',
    summary: 'The callers that send your workload: how many requests arrive per second, and how many are reads or writes.',
    analogy: 'Customers at the door. You choose how ready you are, not how many arrive on payday.',
    useWhen: ['Every design starts with who calls it, how often, and what they ask for.'],
    avoidWhen: [],
    tryInBob: ['In Sandbox, set the peak traffic and the read percentage.', 'Add several client sources to split traffic between them.'],
    failureModes: ['Aggressive client retries multiply load during an incident.', 'A traffic spike arrives faster than capacity can be added.'],
    modelNote: 'Traffic ramps from 10% to 100% of the peak across six snapshots.',
    reading: [{ label: 'Google SRE book: Addressing cascading failures', url: 'https://sre.google/sre-book/addressing-cascading-failures/' }],
  },
  'load-balancer': {
    title: 'Load Balancer',
    summary: 'Spreads requests across application instances and stops sending traffic to instances that fail health checks.',
    analogy: 'A host seating guests at whichever waiter has room, and not at the one who went home sick.',
    useWhen: ['You run more than one API instance.', 'You must survive one instance failing (N+1 capacity).', 'You want to add or remove capacity without clients noticing.'],
    avoidWhen: ['The bottleneck is a shared database: balancing more APIs onto it adds load, not capacity.'],
    tryInBob: ['Connect it to API instances; traffic is weighted by each instance’s capacity.', 'In Labs and Sandbox, take an API offline and watch traffic route around it.'],
    failureModes: ['A single load balancer is itself a single point of failure.', 'If the remaining instances lack headroom, one failure still overloads them.'],
    modelNote: 'Capacity-weighted routing with instant health checks. Algorithms, connection draining, and TLS are not simulated.',
    reading: [
      { label: 'Google SRE book: Load balancing in the datacenter', url: 'https://sre.google/sre-book/load-balancing-datacenter/' },
      { label: 'Load balancing (computing) overview', url: 'https://en.wikipedia.org/wiki/Load_balancing_(computing)' },
    ],
  },
  'api-medium': {
    title: 'API Server',
    summary: 'Stateless application workers that run your business logic. Add instances to scale out horizontally.',
    analogy: 'Chefs in a kitchen. More chefs cook more meals, until everyone is queuing at the same pantry.',
    useWhen: ['API CPU is the bottleneck.', 'You need spare instances so one failure does not cause an outage.'],
    avoidWhen: ['A downstream dependency is saturated: more instances only send it more work.'],
    tryInBob: ['Choose Small (1,500 req/s, $80/mo) or Medium (2,500 req/s, $120/mo).', 'Wire each instance from the load balancer and to its data stores.'],
    failureModes: ['Demand above capacity creates queueing: latency rises before errors appear.', 'In-memory state is lost on restart and invisible to other instances.'],
    modelNote: 'Fixed requests-per-second capacity; a cache hit skips part of a request’s work. Thread pools, garbage collection, and autoscaling are not simulated.',
    reading: [
      { label: 'The Twelve-Factor App: Processes', url: 'https://12factor.net/processes' },
      { label: 'Google SRE book: Handling overload', url: 'https://sre.google/sre-book/handling-overload/' },
    ],
  },
  worker: {
    title: 'Background Worker',
    summary: 'Consumes queued messages after the response has been sent, for example applying writes to a database.',
    analogy: 'The night shift that processes the day’s paperwork at a steady pace.',
    useWhen: ['Work can finish after the caller gets a response.', 'You need to throttle how fast writes reach a database.'],
    avoidWhen: ['The caller must see the result immediately.'],
    tryInBob: ['Wire queue → worker → database.', 'Add workers to drain faster, but each one adds database load.'],
    failureModes: ['Too few workers: the backlog and delay keep growing.', 'Too many workers: they overload the database they write to.'],
    modelNote: 'Each worker drains 1,200 messages/second. Acknowledgements, retries, and poison messages are not simulated.',
    reading: [{ label: 'RabbitMQ tutorial: Work queues', url: 'https://www.rabbitmq.com/tutorials/tutorial-two-python' }],
  },
  kubernetes: {
    title: 'Kubernetes',
    summary: 'A container orchestrator that schedules, restarts, and scales workloads across machines.',
    analogy: 'Building management: it keeps the right offices staffed, but it does not do the work itself.',
    useWhen: ['You run many services and replicas and want consistent deployments.', 'You need automatic restarts and rolling updates.'],
    avoidWhen: ['A few simple services where the operational overhead outweighs the benefit.'],
    tryInBob: ['Design preview: draw it as a boundary around your APIs. Traffic passes through unchanged.'],
    failureModes: ['Autoscaling reacts after load rises, so capacity still needs headroom.'],
    modelNote: 'Design-only in Bob: scheduling, autoscaling, and recovery are not simulated, and it is unpriced.',
    reading: [
      { label: 'Kubernetes overview', url: 'https://kubernetes.io/docs/concepts/overview/' },
      { label: 'Horizontal Pod Autoscaling', url: 'https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/' },
    ],
  },
  postgres: {
    title: 'PostgreSQL',
    summary: 'A relational database and the usual source of truth. Transactions keep related changes consistent.',
    analogy: 'The bank vault. Everything important ends up here, and only so many people fit through the door at once.',
    useWhen: ['You need transactions, constraints, and consistent reads.', 'Data is relational and queried in flexible ways.'],
    avoidWhen: ['Answering the same hot read thousands of times per second: cache it.'],
    tryInBob: ['Writes cost twice a read in this model.', 'Add read replicas for reads, or a second database behind the APIs to model shards.'],
    failureModes: ['Connection pool exhaustion under load.', 'CPU saturation makes every request wait; it becomes the slowest span in a trace.'],
    modelNote: '6,000 weighted operations/second and a 100-connection pool. Query plans, locks, and vacuum are not simulated.',
    reading: [
      { label: 'PostgreSQL documentation', url: 'https://www.postgresql.org/docs/current/' },
      { label: 'PostgreSQL: Transactions', url: 'https://www.postgresql.org/docs/current/tutorial-transactions.html' },
    ],
  },
  mysql: {
    title: 'MySQL',
    summary: 'A widely used relational database with transactions, replication, and the same capacity trade-offs as PostgreSQL.',
    analogy: 'A different brand of vault. The physics of doors and queues stay the same.',
    useWhen: ['Your team or platform already standardizes on MySQL.', 'Relational data that needs transactions.'],
    avoidWhen: ['Switching database engines to fix a capacity problem: the bottleneck usually moves with you.'],
    tryInBob: ['Connect it beside another database behind your APIs to model shards.'],
    failureModes: ['The same as any primary: CPU and connection saturation, replica lag.'],
    modelNote: 'Modeled at the same size and price as PostgreSQL. Engine-specific behavior is not simulated.',
    reading: [
      { label: 'MySQL documentation', url: 'https://dev.mysql.com/doc/' },
      { label: 'MySQL 8.4: Replication', url: 'https://dev.mysql.com/doc/refman/8.4/en/replication.html' },
    ],
  },
  mongodb: {
    title: 'MongoDB',
    summary: 'A document database that stores JSON-like records with flexible schemas.',
    analogy: 'A cabinet of folders, each holding everything about one customer, instead of rows across many tables.',
    useWhen: ['Data is naturally document-shaped and read together.', 'Schemas change often.'],
    avoidWhen: ['You need many joins and strict relational constraints everywhere.'],
    tryInBob: ['Modeled as a primary database. Connect several behind your APIs to model shards.'],
    failureModes: ['Uneven keys create hot shards.', 'The same capacity physics as any primary.'],
    modelNote: 'Modeled at the same size and price as PostgreSQL. Document design, sharding, and change streams are not simulated.',
    reading: [{ label: 'MongoDB manual', url: 'https://www.mongodb.com/docs/manual/' }],
  },
  redis: {
    title: 'Redis',
    summary: 'An in-memory key-value store, most often used as a cache in front of a slower database.',
    analogy: 'A sticky note on your monitor: instant to read, and only useful while it is up to date.',
    useWhen: ['The same data is read far more often than it changes.', 'Database CPU is high from repeated reads.'],
    avoidWhen: ['Every request reads unique data, so the hit rate stays low.', 'Data must always be current and you cannot invalidate it on write.'],
    tryInBob: [
      'Memory: below the hot-data size, popular keys are evicted and the hit rate drops.',
      'TTL: longer keeps keys warm; with TTL-only expiry it also keeps old values longer.',
      'Write policy: invalidate on write, or wait for the TTL.',
      'Break it: flush the cache and watch the stampede reach the database.',
    ],
    failureModes: ['Cold start or flush: misses stampede to the database at once.', 'Stale reads when writes do not invalidate cached values.', 'Too little memory evicts the keys you need.'],
    modelNote: 'Hit rate = TTL ceiling × memory coverage × saturation. Eviction policies and key-level races are not simulated.',
    reading: [
      { label: 'Redis documentation', url: 'https://redis.io/docs/latest/' },
      { label: 'Redis: Key eviction', url: 'https://redis.io/docs/latest/develop/reference/eviction/' },
      { label: 'Redis: EXPIRE and TTLs', url: 'https://redis.io/docs/latest/commands/expire/' },
    ],
  },
  'read-replica': {
    title: 'Read Replica',
    summary: 'A read-only copy of a primary database, updated asynchronously from the primary’s changes.',
    analogy: 'A photocopy of the ledger at the front desk: quick to check, but copied a moment ago.',
    useWhen: ['Read-heavy workloads where a slightly old answer is acceptable.', 'Moving reports or analytics off the primary.'],
    avoidWhen: ['A customer must see their own write immediately, unless you route those reads to the primary.', 'Write-heavy workloads: every replica replays every write.'],
    tryInBob: ['Wire primary → replica for replication and API → replica for reads.', 'Turn on read-your-writes to send a customer’s follow-up reads to the primary.'],
    failureModes: ['Replication lag grows when the primary or replica is busy.', 'Stale reads break the customer’s expectation of seeing their own changes.'],
    modelNote: 'Lag grows with primary and replica load. A follow-up read arrives about a second after a write. Failover is not simulated.',
    reading: [
      { label: 'PostgreSQL: Hot standby', url: 'https://www.postgresql.org/docs/current/hot-standby.html' },
      { label: 'PostgreSQL: Log-shipping standby servers', url: 'https://www.postgresql.org/docs/current/warm-standby.html' },
    ],
  },
  queue: {
    title: 'RabbitMQ',
    summary: 'A message broker. Producers publish work; competing consumers process it later at their own pace.',
    analogy: 'The ticket rail in a busy kitchen: orders wait in line instead of overwhelming the cooks.',
    useWhen: ['Smoothing write spikes so a database is not overwhelmed.', 'Work that can complete after the response.'],
    avoidWhen: ['The caller needs the result in the same request.'],
    tryInBob: ['Wire API → queue → background worker → database.', 'Add workers to drain faster, and watch database CPU as you do.'],
    failureModes: ['The backlog grows when consumers are slower than producers.', 'A full queue rejects publishes.', 'Readers see old data until queued writes are applied.'],
    modelNote: 'Publishes are acknowledged once queued; the backlog is reported after one minute. Acknowledgements, redelivery, and prefetch are not simulated.',
    reading: [
      { label: 'RabbitMQ documentation', url: 'https://www.rabbitmq.com/docs' },
      { label: 'RabbitMQ tutorial: Work queues', url: 'https://www.rabbitmq.com/tutorials/tutorial-two-python' },
    ],
  },
  kafka: {
    title: 'Apache Kafka',
    summary: 'A distributed, partitioned log. Consumers in a group share partitions and read each partition in order.',
    analogy: 'A row of conveyor belts. Each belt serves one worker on a team; more belts allow more workers at once.',
    useWhen: ['High-throughput event streams.', 'Several systems need to read the same events, or replay them later.'],
    avoidWhen: ['A simple task queue with modest traffic.'],
    tryInBob: ['Partitions cap how many consumers in a group receive messages.'],
    failureModes: ['Consumer lag when there are too few partitions or consumers.', 'Hot partitions when message keys are uneven.'],
    modelNote: 'Modeled as a write buffer with one consumer group. Ordering, retention, and replay are not simulated.',
    reading: [
      { label: 'Apache Kafka: Introduction', url: 'https://kafka.apache.org/intro' },
      { label: 'Apache Kafka documentation', url: 'https://kafka.apache.org/documentation/' },
    ],
  },
  outbox: {
    title: 'Transactional Outbox',
    summary: 'Store an event in the same database transaction as the data change, then publish it separately.',
    analogy: 'Writing the receipt in the same pen stroke as the payment, so neither can go missing alone.',
    useWhen: ['A database change must reliably produce an event, without a risky dual write.'],
    avoidWhen: ['Events that may safely be lost or recomputed.'],
    tryInBob: ['Design preview: draw database → outbox → relay → Kafka.'],
    failureModes: ['Without it, a crash between commit and publish loses or duplicates events.'],
    modelNote: 'Design-only in Bob. Event delivery is the subject of the upcoming Missing Event mission.',
    reading: [{ label: 'Pattern: Transactional outbox', url: 'https://microservices.io/patterns/data/transactional-outbox.html' }],
  },
  cdc: {
    title: 'Change Data Capture',
    summary: 'Streams committed database changes to other systems, often to relay an outbox table.',
    analogy: 'A court stenographer: whatever the database commits, it writes down for everyone else.',
    useWhen: ['Relaying an outbox table, or replicating changes to search, caches, or analytics.'],
    avoidWhen: ['A direct call is simpler and the extra lag is unacceptable.'],
    tryInBob: ['Design preview: connect database → CDC → Kafka.'],
    failureModes: ['Connector lag or lost offsets.', 'Schema changes break downstream consumers.'],
    modelNote: 'Design-only in Bob: offsets, delivery, and recovery are not simulated.',
    reading: [{ label: 'Debezium documentation', url: 'https://debezium.io/documentation/reference/stable/index.html' }],
  },
};
