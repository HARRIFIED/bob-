import { labs } from '../scenarios/labs';
import type { GuideKey } from './component-guides';

/** Mission stars reward engineering habits, never avoiding help: completion, evidence first, and cost. */
export interface MissionStars { evidence: boolean; efficient: boolean }
export interface Progress {
  version: 1;
  labs: string[];
  /** Sandbox design challenges whose goals were all met. */
  challenges: string[];
  missions: Record<string, MissionStars>;
  guides: string[];
  /** Quick-check id → whether the latest answer was correct. */
  checks: Record<string, boolean>;
}
export interface Badge { id: string; title: string; description: string; earned: boolean }

export const progressStorageKey = 'bob.progress.v1';
export const emptyProgress: Progress = { version: 1, labs: [], challenges: [], missions: {}, guides: [], checks: {} };

export const starCount = (stars: MissionStars | undefined) => stars ? 1 + Number(stars.evidence) + Number(stars.efficient) : 0;

const strings = (value: unknown, max: number) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length <= max).slice(0, 200) : [];
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Restore saved progress defensively; anything malformed is dropped rather than trusted. */
export function parseProgress(source: string | null): Progress {
  if (!source || source.length > 100_000) return emptyProgress;
  try {
    const data: unknown = JSON.parse(source);
    if (!record(data) || data.version !== 1) return emptyProgress;
    const missions: Record<string, MissionStars> = {};
    if (record(data.missions)) {
      for (const [id, stars] of Object.entries(data.missions).slice(0, 50)) {
        if (record(stars)) missions[id] = { evidence: stars.evidence === true, efficient: stars.efficient === true };
      }
    }
    const checks: Record<string, boolean> = {};
    if (record(data.checks)) {
      for (const [id, correct] of Object.entries(data.checks).slice(0, 200)) if (typeof correct === 'boolean') checks[id] = correct;
    }
    return { version: 1, labs: strings(data.labs, 80), challenges: strings(data.challenges, 80), missions, guides: strings(data.guides, 40), checks };
  } catch {
    return emptyProgress;
  }
}

export const completeLab = (progress: Progress, id: string): Progress =>
  progress.labs.includes(id) ? progress : { ...progress, labs: [...progress.labs, id] };

export const completeChallenge = (progress: Progress, id: string): Progress =>
  progress.challenges.includes(id) ? progress : { ...progress, challenges: [...progress.challenges, id] };

/** Keep the best result for each star, so replaying never loses progress. */
export function completeMission(progress: Progress, id: string, stars: MissionStars): Progress {
  const previous = progress.missions[id];
  const best = { evidence: stars.evidence || !!previous?.evidence, efficient: stars.efficient || !!previous?.efficient };
  return previous && previous.evidence === best.evidence && previous.efficient === best.efficient
    ? progress
    : { ...progress, missions: { ...progress.missions, [id]: best } };
}

export const readGuide = (progress: Progress, key: GuideKey): Progress =>
  progress.guides.includes(key) ? progress : { ...progress, guides: [...progress.guides, key] };

export const answerCheck = (progress: Progress, id: string, correct: boolean): Progress =>
  progress.checks[id] === correct ? progress : { ...progress, checks: { ...progress.checks, [id]: correct } };

const labsDone = (progress: Progress, ids: string[]) => ids.every(id => progress.labs.includes(id));

export function badges(progress: Progress): Badge[] {
  const completions = progress.labs.length + progress.challenges.length + Object.keys(progress.missions).length;
  const correct = Object.values(progress.checks).filter(Boolean).length;
  return [
    { id: 'first-fix', title: 'First Fix', description: 'Complete a mission, lab, or challenge.', earned: completions > 0 },
    { id: 'bottleneck-hunter', title: 'Bottleneck Hunter', description: 'Open traces, logs, or the ledger before changing a failing mission design.', earned: Object.values(progress.missions).some(stars => stars.evidence) },
    { id: 'penny-wise', title: 'Penny Wise', description: 'Finish a mission under its stretch budget.', earned: Object.values(progress.missions).some(stars => stars.efficient) },
    { id: 'cache-whisperer', title: 'Cache Whisperer', description: 'Complete every Redis lab.', earned: labsDone(progress, labs.filter(item => item.component === 'redis').map(item => item.id)) },
    { id: 'replica-wrangler', title: 'Replica Wrangler', description: 'Complete both read replica labs.', earned: labsDone(progress, labs.filter(item => item.component === 'read-replica').map(item => item.id)) },
    { id: 'queue-tamer', title: 'Queue Tamer', description: 'Complete the RabbitMQ and Kafka labs.', earned: labsDone(progress, labs.filter(item => item.component === 'queue' || item.component === 'kafka').map(item => item.id)) },
    { id: 'chaos-survivor', title: 'Chaos Survivor', description: 'Survive an instance failure and a cold cache.', earned: labsDone(progress, ['survive-failure', 'redis-cold-start']) },
    { id: 'challenger', title: 'Design Challenger', description: 'Meet every goal of a Sandbox design challenge.', earned: progress.challenges.length > 0 },
    { id: 'field-scholar', title: 'Field Scholar', description: 'Read five Field Guide entries.', earned: progress.guides.length >= 5 },
    { id: 'sharp-eyes', title: 'Sharp Eyes', description: 'Answer five quick checks correctly.', earned: correct >= 5 },
    { id: 'architect', title: 'Architect', description: 'Complete every Component Lab.', earned: labsDone(progress, labs.map(item => item.id)) },
  ];
}

/** Quick checks the learner missed last time, for spaced review. */
export const missedChecks = (progress: Progress) => Object.entries(progress.checks).filter(([, correct]) => !correct).map(([id]) => id);
