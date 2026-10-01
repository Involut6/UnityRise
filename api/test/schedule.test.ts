import { describe, expect, it } from 'vitest';
import { buildSchedule } from '../src/modules/loans';

const kobo = (n: number) => Math.round(n * 100);

describe('buildSchedule (interest-free)', () => {
  it('instalments sum exactly to the loan amount (no drift)', () => {
    for (const [p, m] of [[100000, 24], [333333.33, 36], [1000, 7], [5_000_000, 120], [100, 3]] as const) {
      const sum = buildSchedule(p, m).reduce((a, r) => a + kobo(r.principal), 0);
      expect(sum).toBe(kobo(p));
    }
  });
  it('splits evenly; only the last instalment absorbs the kobo remainder', () => {
    const s = buildSchedule(100, 3);
    expect(s.map(r => r.principal)).toEqual([33.33, 33.33, 33.34]);
    expect(buildSchedule(1200, 12).every(r => r.principal === 100)).toBe(true);
  });
  it('has no interest component', () => {
    expect(Object.keys(buildSchedule(1000, 4)[0]).sort()).toEqual(['due', 'no', 'principal']);
  });
  it('produces one row per month with monotonically increasing due dates', () => {
    const s = buildSchedule(120000, 12, new Date('2026-01-15T00:00:00Z'));
    expect(s).toHaveLength(12);
    expect(s[0].due).toBe('2026-02-15');
    expect(s.map(r => r.due)).toEqual([...s.map(r => r.due)].sort());
  });
  it('clamps day-of-month to 28 so due dates always exist', () => {
    expect(buildSchedule(1000, 3, new Date('2026-01-31T00:00:00Z'))[0].due).toBe('2026-02-28');
  });
});
