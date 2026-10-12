import { isComponentKind, kafkaPartitionOptions, redisMemoryOptions, redisTtlOptions } from '../data/component-definitions';
import { capacityMentorRules } from '../scenarios/capacity-mentor';
import { challengeById } from '../scenarios/challenges';
import { paydaySurge } from '../scenarios/payday-surge';
import { doubleDebit } from '../scenarios/double-debit';
import type { ArchitectureNode, ArchitectureState, NodeConfig, NodeFault, ScenarioDefinition } from './types';

export interface SandboxSettings {
  workload: 'capacity' | 'transfers';
  peak: number;
  readFraction: number;
  budget: number;
  targets: boolean;
  lostResponses: boolean;
  restartWorker: boolean;
  /** Re-measure automatically after every change. */
  live: boolean;
  /** Active design challenge; its workload and goals replace the free-form ones. */
  challenge: string | null;
}
export interface SandboxProject {
  version: 1;
  name: string;
  settings: SandboxSettings;
  architecture: ArchitectureState;
}
export const sandboxStorageKey = 'bob.sandbox.v1';
export const defaultSandboxSettings: SandboxSettings = {
  workload: 'capacity', peak: 12000, readFraction: 0.9, budget: 1500,
  targets: false, lostResponses: true, restartWorker: true, live: false, challenge: null,
};

export function sandboxScenario(settings: SandboxSettings): ScenarioDefinition {
  const capacity = settings.workload === 'capacity';
  const base = capacity ? paydaySurge : doubleDebit;
  const challenge = capacity ? challengeById(settings.challenge) : undefined;
  const peak = challenge?.peak ?? settings.peak;
  const readFraction = challenge?.readFraction ?? settings.readFraction;
  return {
    ...base, id: 'sandbox', title: challenge?.title ?? 'Sandbox', company: 'Your workspace', incidentId: challenge ? 'CHALLENGE' : 'LOCAL LAB',
    budget: challenge?.budget ?? settings.budget,
    trafficProfile: { ...base.trafficProfile, normal: peak * (capacity ? 0.1 : 1), peak, readFraction },
    objectives: challenge ? challenge.objectives : settings.targets ? base.objectives.map(o => o.id === 'cost' ? { ...o, target: settings.budget } : o) : [],
    mentorRules: capacity ? capacityMentorRules : base.mentorRules,
    presentation: { ...base.presentation, missionTitle: 'Your experiment', loadLabel: 'TEST LOAD',
      loadDescription: 'A deterministic local experiment with your workload settings.',
      correctnessNote: capacity
        ? 'Flow model: requests follow your connections. Stale reads come from replica lag, TTL-only caches, or queued writes.'
        : 'Transfer model: atomic shared key lookup and a fixed three-transfer sample.',
    },
    scriptedEvents: base.scriptedEvents.map((event, index) => ({
      phase: event.phase, message: capacity ? 'Applying the configured traffic ramp' : `Replaying transfer sample, phase ${index + 1}`,
    })),
    ...(base.transfers ? { transfers: {
      ...base.transfers,
      attempts: base.transfers.attempts.filter(a => settings.lostResponses || a.attempt === 1).map(a => ({
        ...a, responseLost: settings.lostResponses && a.responseLost, restartWorker: settings.restartWorker && !!a.restartWorker,
      })),
    } } : {}),
  };
}

const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const string = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const oneOf = <T,>(v: unknown, options: readonly T[]): v is T => options.includes(v as T);
const faults: NodeFault[] = ['down', 'slow', 'cold'];
function invalid(): never { throw new Error('Invalid sandbox file. Use a version 1 Bob sandbox export with valid components, connections, and workload settings.'); }

function parseConfig(value: unknown): NodeConfig {
  if (!object(value)) invalid();
  const config: NodeConfig = {};
  if (value.memoryGb !== undefined) {
    if (!oneOf(value.memoryGb, redisMemoryOptions.map(option => option.gb))) invalid();
    config.memoryGb = value.memoryGb;
  }
  if (value.ttlSeconds !== undefined) {
    if (!oneOf(value.ttlSeconds, redisTtlOptions.map(option => option.seconds))) invalid();
    config.ttlSeconds = value.ttlSeconds;
  }
  if (value.writePolicy !== undefined) {
    if (!oneOf(value.writePolicy, ['invalidate', 'ttl-only'] as const)) invalid();
    config.writePolicy = value.writePolicy;
  }
  if (value.partitions !== undefined) {
    if (!oneOf(value.partitions, kafkaPartitionOptions)) invalid();
    config.partitions = value.partitions;
  }
  if (value.readYourWrites !== undefined) {
    if (typeof value.readYourWrites !== 'boolean') invalid();
    config.readYourWrites = value.readYourWrites;
  }
  return config;
}

/** Validate and reconstruct untrusted JSON; never restore telemetry or running state. */
export function parseSandboxProject(source: string): SandboxProject {
  if (source.length > 500_000) invalid();
  const data: unknown = JSON.parse(source);
  if (!object(data) || data.version !== 1 || !string(data.name, 80) || !object(data.settings) || !object(data.architecture)) invalid();
  const s = data.settings;
  if ((s.workload !== 'capacity' && s.workload !== 'transfers') || !finite(s.peak, 1, 100000) ||
      !finite(s.readFraction, 0, 1) || !finite(s.budget, 0, 1000000) || typeof s.targets !== 'boolean' ||
      typeof s.lostResponses !== 'boolean' || typeof s.restartWorker !== 'boolean') invalid();
  if ((s.live !== undefined && typeof s.live !== 'boolean') || (s.challenge !== undefined && s.challenge !== null && !challengeById(String(s.challenge)))) invalid();
  const settings: SandboxSettings = { workload: s.workload, peak: s.peak, readFraction: s.readFraction, budget: s.budget,
    targets: s.targets, lostResponses: s.lostResponses, restartWorker: s.restartWorker,
    live: s.live === true, challenge: challengeById(typeof s.challenge === 'string' ? s.challenge : null)?.id ?? null };
  const a = data.architecture;
  if (!Array.isArray(a.nodes) || a.nodes.length > 60 || !Array.isArray(a.edges) || a.edges.length > 3540) invalid();
  const nodes: ArchitectureNode[] = a.nodes.map((n: unknown) => {
    if (!object(n) || !string(n.id, 80) || !/^[a-zA-Z0-9_-]+$/.test(n.id) || typeof n.kind !== 'string' || !isComponentKind(n.kind) ||
        !string(n.label, 80) || !object(n.position) || !finite(n.position.x, -100000, 100000) || !finite(n.position.y, -100000, 100000)) invalid();
    const node: ArchitectureNode = { id: n.id, kind: n.kind, label: n.label, added: true, position: { x: n.position.x, y: n.position.y } };
    if (n.retryPolicy !== undefined) {
      const r = n.retryPolicy;
      if (!object(r) || typeof r.enabled !== 'boolean' || !['same-key', 'new-key', 'none'].includes(String(r.keyStrategy))) invalid();
      node.retryPolicy = { enabled: r.enabled, keyStrategy: r.keyStrategy === 'new-key' ? 'new-key' : r.keyStrategy === 'none' ? 'none' : 'same-key' };
    }
    if (n.config !== undefined) node.config = parseConfig(n.config);
    if (n.fault !== undefined) {
      if (!oneOf(n.fault, faults)) invalid();
      node.fault = n.fault;
    }
    return node;
  });
  const ids = new Set(nodes.map(n => n.id));
  if (ids.size !== nodes.length || nodes.filter(n => n.kind.startsWith('api-')).length > 12) invalid();
  const edges = a.edges.map((e: unknown) => {
    if (!object(e) || !string(e.source, 80) || !string(e.target, 80) || !ids.has(e.source) || !ids.has(e.target) || e.source === e.target) invalid();
    return { id: `${e.source}-${e.target}`, source: e.source, target: e.target };
  });
  if (new Set(edges.map(e => e.id)).size !== edges.length) invalid();
  if (a.requestHandling !== undefined && !['always-create', 'worker-memory', 'postgres'].includes(String(a.requestHandling))) invalid();
  return { version: 1, name: data.name, settings, architecture: { nodes, edges,
    requestHandling: a.requestHandling === 'postgres' ? 'postgres' : a.requestHandling === 'worker-memory' ? 'worker-memory' : 'always-create' } };
}
