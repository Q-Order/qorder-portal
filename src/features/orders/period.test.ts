import { describe, expect, it } from 'vitest';
import { inPeriod, presetPeriod } from './myOrdersModel';

describe('период «Моих заявок»', () => {
  const now = new Date(2026, 10, 15, 12, 0);

  it('готовые периоды считают сегодняшний день', () => {
    expect(presetPeriod('all', now)).toEqual({});
    expect(presetPeriod('today', now)).toEqual({ from: '2026-11-15', to: '2026-11-15' });
    expect(presetPeriod('week', now)).toEqual({ from: '2026-11-09', to: '2026-11-15' });
    expect(presetPeriod('month', now)).toEqual({ from: '2026-10-17', to: '2026-11-15' });
  });

  it('границы включительно, пустая граница не ограничивает', () => {
    const order = { createdAt: new Date(2026, 10, 9, 23, 30).toISOString() };
    expect(inPeriod(order, { from: '2026-11-09', to: '2026-11-09' })).toBe(true);
    expect(inPeriod(order, { from: '2026-11-10' })).toBe(false);
    expect(inPeriod(order, { to: '2026-11-08' })).toBe(false);
    expect(inPeriod(order, {})).toBe(true);
  });
});
