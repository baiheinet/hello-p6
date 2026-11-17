import {
  rebalance,
  evenSchedule,
  laborDemand,
  roundLabor,
} from '../../server/services/resource-planning.js';
import { describe, expect, it } from 'vitest';

describe('evenSchedule', () => {
  it('splits the total evenly when it divides exactly', () => {
    expect(evenSchedule(10000, 10)).toEqual(new Array(10).fill(1000));
  });
  it('keeps the total exact when it does not divide', () => {
    const values = evenSchedule(100, 3);
    expect(values.reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(values).toEqual([34, 33, 33]);
  });
  it('keeps the total exact for a fractional total', () => {
    const values = evenSchedule(100.5, 3);
    expect(values.reduce((sum, value) => sum + value, 0)).toBe(100.5);
    // 100.5 / 3 = 33.5: two periods carry 34, the last absorbs 33.
    expect(values).toEqual([34, 34, 32.5]);
  });
  it('answers an empty schedule for a zero period count', () => {
    expect(evenSchedule(10, 0)).toEqual([]);
  });
});

describe('rebalance', () => {
  it('pins one period and spreads the rest without changing the total', () => {
    const schedule = new Array(10).fill(1000);
    const next = rebalance(schedule, 3, 2500);
    expect(next[3]).toBe(2500);
    expect(next.reduce((sum, value) => sum + value, 0)).toBe(10000);
  });
  it('keeps a single period intact', () => {
    expect(rebalance([5], 0, 5)).toEqual([5]);
  });
});

describe('laborDemand', () => {
  it('multiplies the period quantity by the global quota', () => {
    const trades = [
      { id: '1', name: 'Rebar', unitQuota: 0.2, createdAt: '', updatedAt: '' },
    ];
    const rows = laborDemand(
      {
        schedule: [1000, 2000],
        laborOverrides: null,
      },
      trades,
    );
    expect(rows).toEqual([
      {
        trade: 'Rebar',
        periodIndex: 0,
        quantity: 1000,
        override: null,
        value: 200,
      },
      {
        trade: 'Rebar',
        periodIndex: 1,
        quantity: 2000,
        override: null,
        value: 400,
      },
    ]);
  });
  it('applies a manual override to the single cell it names', () => {
    const trades = [
      {
        id: '1',
        name: 'Formwork',
        unitQuota: 0.5,
        createdAt: '',
        updatedAt: '',
      },
    ];
    const rows = laborDemand(
      {
        schedule: [1000, 2000],
        laborOverrides: { Formwork: { '0': 300 } },
      },
      trades,
    );
    expect(rows[0]).toMatchObject({ value: 300, override: 300 });
    expect(rows[1]).toMatchObject({ value: 1000, override: null });
  });
  it('treats a null override as a removal, falling back to the quota', () => {
    const trades = [
      { id: '1', name: 'Crew', unitQuota: 1, createdAt: '', updatedAt: '' },
    ];
    const rows = laborDemand(
      {
        schedule: [500],
        laborOverrides: { Crew: { '0': null } },
      },
      trades,
    );
    expect(rows[0].value).toBe(500);
    expect(rows[0].override).toBeNull();
  });
  it('rounds to one decimal so charts and tables agree', () => {
    expect(roundLabor(0.1 * 3)).toBe(0.3);
    expect(roundLabor(123.456)).toBe(123.5);
  });
});
