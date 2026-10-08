export type ComponentKind = 'users' | 'load-balancer' | 'api-small' | 'api-medium' | 'postgres' | 'redis' | 'read-replica' | 'queue' | 'kafka' | 'idempotency' | 'outbox';
export type Health = 'healthy' | 'warning' | 'critical' | 'failed';
export interface ComponentDefinition {
  id: ComponentKind; name: string; category: string; capacity: number; baseLatency: number;
  vcpu: number; memory: number; monthlyCost: number; description: string;
  available: boolean; readCapacity?: number; writeCapacity?: number; connectionLimit?: number; cacheHitRate?: number;
}
export interface ArchitectureNode {
  id: string; kind: ComponentKind; label: string; position: { x: number; y: number }; added: boolean;
}
export interface ArchitectureEdge { id: string; source: string; target: string }
export interface ArchitectureState { nodes: ArchitectureNode[]; edges: ArchitectureEdge[] }
export interface TelemetrySnapshot {
  traffic: number; apiCpu: number; dbCpu: number; dbConnections: number; cacheHitRate: number;
  p95: number; errorRate: number; incorrectBalances: number; availability: number; cost: number;
}
export interface NodeTelemetry { traffic: number; cpu: number; memory: number; health: Health; connections?: number; cacheHitRate?: number }
export interface IncidentEvent { time: string; level: 'INFO' | 'WARN' | 'ERROR'; message: string }
export interface TraceSpan { name: string; duration: number; kind: 'compute' | 'data' | 'cache' | 'other' }
export interface MissionObjective { id: keyof TelemetrySnapshot; label: string; target: number; comparison: 'lt' | 'lte' | 'eq' | 'gte'; unit: string }
export interface MentorMessage { id: string; text: string }
export interface ScenarioDefinition {
  id: string; title: string; company: string; description: string; initialArchitecture: ArchitectureState;
  trafficProfile: { normal: number; peak: number; readFraction: number; writeWeight: number; ramp: number[] };
  budget: number; objectives: MissionObjective[]; scriptedEvents: { phase: string; message: string }[];
  mentorRules: Record<string, MentorMessage>;
  model: { apiCacheRelief: number; baseP95: number; maxApiQueue: number; maxDbQueue: number; apiQueueFactor: number; dbQueueFactor: number };
  explanations: { worked: string; tradeoff: string };
}
export interface SimulationInput { scenario: ScenarioDefinition; architecture: ArchitectureState; traffic?: number }
export interface SimulationResult {
  telemetry: TelemetrySnapshot; nodes: Record<string, NodeTelemetry>; logs: IncidentEvent[];
  trace: TraceSpan[]; objectives: (MissionObjective & { passed: boolean; actual: number })[];
  mentor: MentorMessage; missionState: 'stable' | 'incident'; disconnected: string[];
}
