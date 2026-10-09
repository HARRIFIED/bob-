export type ComponentKind = 'users' | 'load-balancer' | 'api-small' | 'api-medium' | 'postgres' | 'redis' | 'read-replica' | 'queue' | 'kafka' | 'outbox';
export type Health = 'healthy' | 'warning' | 'critical' | 'failed';
export interface ComponentDefinition {
  id: ComponentKind; name: string; category: string; capacity: number; baseLatency: number;
  vcpu: number; memory: number; monthlyCost: number; description: string;
  available: boolean; readCapacity?: number; writeCapacity?: number; connectionLimit?: number; cacheHitRate?: number;
}
export interface ArchitectureNode {
  id: string; kind: ComponentKind; label: string; position: { x: number; y: number }; added: boolean;
  retryPolicy?: RetryPolicy;
}
export interface RetryPolicy { enabled: boolean; keyStrategy: 'same-key' | 'new-key' | 'none' }
export type RequestHandling = 'always-create' | 'worker-memory' | 'postgres';
export interface TransferResponse {
  receiptId: string; transferId: string; recipient: string; amountMinor: number; currency: string; status: 'completed';
}
export interface TransferRecord {
  key: string; account: string; fingerprint: string; apiId: string; response: TransferResponse;
}
export interface TransferIntent { id: string; key: string; recipient: string; amountMinor: number }
export interface TransferAttempt { id: string; transferId: string; attempt: number; phase: number; time: string; responseLost: boolean; restartWorker?: boolean }
export interface TransferFixture {
  account: string; currency: string; openingBalanceMinor: number;
  intents: TransferIntent[]; attempts: TransferAttempt[]; timeoutMs: number;
}
export interface LedgerPosting {
  receiptId: string; transferId: string; recipient: string; key: string | null; apiId: string;
  time: string; amountMinor: number; balanceMinor: number; duplicate: boolean;
}
export interface AttemptOutcome extends TransferAttempt {
  apiId: string; key: string | null; outcome: 'committed' | 'replayed' | 'unavailable' | 'conflict';
  receiptId: string | null; amountMinor: number; balanceMinor: number;
  recipient: string; requestedAmountMinor: number; response: TransferResponse | null;
  lookup: 'skipped' | 'miss' | 'hit' | 'conflict';
}
export interface TransactionLedger {
  account: string; currency: string; openingBalanceMinor: number; expectedBalanceMinor: number; actualBalanceMinor: number;
  postings: LedgerPosting[]; attempts: AttemptOutcome[]; plannedTransfers: number; confirmedTransfers: number;
  recordStore: RequestHandling; records: TransferRecord[];
}
export interface ArchitectureEdge { id: string; source: string; target: string }
export interface ArchitectureState { nodes: ArchitectureNode[]; edges: ArchitectureEdge[]; requestHandling?: RequestHandling }
export interface TelemetrySnapshot {
  traffic: number; apiCpu: number; dbCpu: number; dbConnections: number; cacheHitRate: number;
  p95: number; errorRate: number; incorrectBalances: number; availability: number; cost: number;
  duplicateDebits: number; retryAttempts: number; replayedRequests: number; completionRate: number;
}
export interface NodeTelemetry { traffic: number; cpu: number; memory: number; health: Health; connections?: number; cacheHitRate?: number; detail?: string }
export interface IncidentEvent { time: string; level: 'INFO' | 'WARN' | 'ERROR'; message: string }
export interface TraceSpan { name: string; duration: number; kind: 'compute' | 'data' | 'cache' | 'other' }
export interface MissionObjective { id: keyof TelemetrySnapshot; label: string; target: number; comparison: 'lt' | 'lte' | 'eq' | 'gte'; unit: string }
export interface MentorMessage { id: string; text: string }
export interface ScenarioDefinition {
  id: string; title: string; company: string; description: string; initialArchitecture: ArchitectureState;
  engine: 'capacity' | 'transfers'; number: string; incidentId: string;
  presentation: {
    subtitle: string; supportQuote: string; symptoms: string; infrastructure: string; missionTitle: string;
    loadLabel: string; loadDescription: string; correctnessNote: string; learningTip: string; completionText: string;
    requestMethod: string; requestPath: string; initialTab: 'Metrics' | 'Ledger';
  };
  transfers?: TransferFixture;
  trafficProfile: { normal: number; peak: number; readFraction: number; writeWeight: number; ramp: number[] };
  budget: number; objectives: MissionObjective[]; scriptedEvents: { phase: string; message: string }[];
  mentorRules: Record<string, MentorMessage>;
  model: { apiCacheRelief: number; baseP95: number; maxApiQueue: number; maxDbQueue: number; apiQueueFactor: number; dbQueueFactor: number };
  explanations: { worked: string; tradeoff: string };
}
export interface SimulationInput { scenario: ScenarioDefinition; architecture: ArchitectureState; traffic?: number; phase?: number }
export interface SimulationResult {
  telemetry: TelemetrySnapshot; nodes: Record<string, NodeTelemetry>; logs: IncidentEvent[];
  trace: TraceSpan[]; objectives: (MissionObjective & { passed: boolean; actual: number })[];
  mentor: MentorMessage; missionState: 'stable' | 'incident'; disconnected: string[];
  ledger?: TransactionLedger;
}
