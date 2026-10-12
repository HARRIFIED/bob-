import { clamp, round } from './formulas';
import type { ComponentRole, ScenarioDefinition } from './types';

/**
 * Teaching assumptions for the flow engine. Every value here is a simplified,
 * documented estimate, not a measurement of real infrastructure.
 */
export const timeoutMs = 2000;
export const slowFaultMs = 200;
export const cacheDownPenaltyMs = 50;
export const coldCacheFactor = 0.1;
/** Follow-up reads arrive on average one second after the customer's write. */
export const followUpDelayMs = 1000;
/** Queue backlog is reported after one minute at the measured load. */
export const backlogWindowSeconds = 60;
export const asyncProcessingMs = 100;
export const maxAsyncLagMs = 600_000;
export const defaultWorkingSetGb = 4;
export const defaultFollowUpReadShare = 0.3;
/**
 * Fixed work on every completed request. The shorter network span on cached paths is
 * calibrated so the illustrative trace keeps Payday Surge's documented 145 ms base.
 */
export const requestOverhead = { authentication: 12, serialization: 8, network: 25, networkWithCache: 20 };

/** Longer TTLs keep popular keys warm for longer: the hit-rate ceiling at full memory coverage. */
const ttlHitCeiling: Record<number, number> = { 10: 0.5, 60: 0.72, 300: 0.82, 3600: 0.88 };

/** Popular keys receive most reads, so half the memory still covers about 70% of hot reads. */
export function memoryCoverage(memoryGb: number, workingSetGb: number) {
  return clamp(Math.sqrt(memoryGb / Math.max(0.1, workingSetGb)), 0, 1);
}

export function cacheHitRate(options: {
  ttlSeconds: number; memoryGb: number; workingSetGb: number; cold: boolean; capacity: number; load: number;
}) {
  const ceiling = ttlHitCeiling[options.ttlSeconds] ?? ttlHitCeiling[300];
  const saturation = Math.min(1, options.capacity / Math.max(1, options.load));
  return ceiling * memoryCoverage(options.memoryGb, options.workingSetGb) * (options.cold ? coldCacheFactor : 1) * saturation;
}

export function cpuFor(role: ComponentRole, pressure: number) {
  switch (role) {
    case 'database': case 'replica':
      return round(pressure >= 1 ? clamp(90 + pressure * 3.2, 90, 97) : 18 + pressure * 67);
    case 'router': return round(clamp(8 + pressure * 70, 0, 98));
    case 'cache': return round(clamp(12 + pressure * 65, 0, 98));
    case 'queue': return round(clamp(10 + pressure * 60, 0, 98));
    case 'compute': case 'consumer': return round(clamp(18 + pressure * 78, 0, 98));
    default: return 0;
  }
}

/** Waiting time added when demand exceeds capacity, capped to keep the model readable. */
export function queueDelay(role: ComponentRole, pressure: number, model: ScenarioDefinition['model']) {
  const excess = Math.max(0, pressure - 1);
  switch (role) {
    case 'database': case 'replica': return round(Math.min(model.maxDbQueue, excess * model.dbQueueFactor));
    case 'compute': case 'consumer': case 'router': return round(Math.min(model.maxApiQueue, excess * model.apiQueueFactor));
    case 'cache': case 'queue': return round(Math.min(60, excess * 60));
    default: return 0;
  }
}

/** Percentage of passing requests that error because this component is overloaded. */
export function overloadErrorPct(role: ComponentRole, pressure: number) {
  const excess = Math.max(0, pressure - 1);
  if (role === 'compute' || role === 'router') return excess * 2;
  if (role === 'database' || role === 'replica') return Math.min(11, excess * 10);
  return 0;
}

/** Replicas replay the primary's writes; a busy primary or replica falls further behind. */
export function replicaLagMs(primaryPressure: number, replicaPressure: number) {
  const lag = 20 + 450 * Math.max(0, primaryPressure - 0.6) + 300 * Math.max(0, replicaPressure - 0.9) + 2000 * Math.max(0, replicaPressure - 1);
  return round(Math.min(30_000, lag));
}

/** Probability that a follow-up read lands inside a window where the old value is still served. */
export function staleProbability(windowMs: number) {
  return windowMs > 0 ? 1 - Math.exp(-windowMs / followUpDelayMs) : 0;
}
