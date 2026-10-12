import { describe, expect, it } from 'vitest';
import { labs } from '../scenarios/labs';
import { answerCheck, badges, completeLab, completeMission, emptyProgress, missedChecks, parseProgress, readGuide, starCount } from './progress';

describe('learning progress', () => {
  it('records labs once and keeps the best stars when a mission is replayed', () => {
    let progress = completeLab(completeLab(emptyProgress, 'redis-shield'), 'redis-shield');
    expect(progress.labs).toEqual(['redis-shield']);
    progress = completeMission(progress, 'payday-surge', { evidence: true, efficient: false });
    progress = completeMission(progress, 'payday-surge', { evidence: false, efficient: true });
    expect(starCount(progress.missions['payday-surge'])).toBe(3);
    expect(completeMission(progress, 'payday-surge', { evidence: false, efficient: false })).toBe(progress);
  });
  it('awards badges from recorded learning, not from clicks', () => {
    expect(badges(emptyProgress).every(badge => !badge.earned)).toBe(true);
    const redis = labs.filter(item => item.component === 'redis').reduce((progress, item) => completeLab(progress, item.id), emptyProgress);
    const earned = badges(redis).filter(badge => badge.earned).map(badge => badge.id);
    expect(earned).toEqual(['first-fix', 'cache-whisperer']);
    const read = (['redis', 'postgres', 'kafka', 'queue', 'mysql'] as const).reduce(readGuide, emptyProgress);
    expect(badges(read).find(badge => badge.id === 'field-scholar')?.earned).toBe(true);
  });
  it('tracks the latest quick-check answer for review', () => {
    let progress = answerCheck(emptyProgress, 'payday-surge:database', false);
    expect(missedChecks(progress)).toEqual(['payday-surge:database']);
    progress = answerCheck(progress, 'payday-surge:database', true);
    expect(missedChecks(progress)).toEqual([]);
  });
  it('restores saved progress defensively', () => {
    const saved = JSON.stringify(completeMission(completeLab(emptyProgress, 'scale-out'), 'double-debit', { evidence: true, efficient: true }));
    expect(parseProgress(saved).labs).toEqual(['scale-out']);
    expect(parseProgress(saved).missions['double-debit']).toEqual({ evidence: true, efficient: true });
    for (const bad of [null, '', '{', '[]', '{"version":2}', JSON.stringify({ version: 1, labs: [5, 'ok'], missions: { x: 'yes' }, checks: { a: 'no' } })]) {
      const parsed = parseProgress(bad);
      expect(parsed.version).toBe(1);
      expect(parsed.labs.every(item => typeof item === 'string')).toBe(true);
      expect(Object.keys(parsed.checks)).toEqual([]);
    }
  });
});
