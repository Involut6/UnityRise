import { describe, expect, it } from 'vitest';
import { buildSchedule } from '../src/modules/loans';

const kobo = (n: number) => Math.round(n * 100);

describe('buildSchedule', () => {
  it('principals sum exactly to the loan amount (no drift)', () => {
    for (const [p, rate, m] of [[100000, 12, 24], [333333.33, 15, 36], [1000, 8, 6], [5_000_000, 12, 120]] as const) {
      const sum = buildSchedule(p, rate, m).reduce((a, r) => a + kobo(r.principal), 0);
      expect(sum).toBe(kobo(p));
    }
  });
  it('produces one row per month with monotonically increasing due dates', () => {
    const s = buildSchedule(120000, 12, 12, new Date('2026-01-15T00:00:00Z'));
    expect(s).toHaveLength(12);
    expect(s[0].due).toBe('2026-02-15');
    expect(s.map(r => r.due)).toEqual([...s.map(r => r.due)].sort());
  });
  it('handles zero interest as equal principal splits', () => {
    const s = buildSchedule(1200, 0, 12);
    expect(s.every(r => r.interest === 0)).toBe(true);
    expect(s.reduce((a, r) => a + kobo(r.principal), 0)).toBe(120000);
  });
  it('first-month interest is balance × monthly rate', () => {
    expect(buildSchedule(100000, 12, 12)[0].interest).toBe(1000);
  });
  it('clamps day-of-month to 28 so due dates always exist', () => {
    expect(buildSchedule(1000, 10, 3, new Date('2026-01-31T00:00:00Z'))[0].due).toBe('2026-02-28');
  });
});
