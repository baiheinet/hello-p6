import {
  rebalance,
  evenSchedule,
  latestStartCumulative,
  latestStartSchedule,
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

describe('latestStartCumulative', () => {
  const uniform = new Array(10).fill(1000);

  it('ends at the schedule total and rises monotonically', () => {
    const latest = latestStartCumulative(uniform);
    expect(latest).toHaveLength(uniform.length);
    expect(latest[latest.length - 1]).toBe(10000);
    for (let index = 1; index < latest.length; index += 1) {
      expect(latest[index]).toBeGreaterThanOrEqual(latest[index - 1]);
    }
  });

  it('stays below the plan cumulative so the plan is the early bound', () => {
    const latest = latestStartCumulative(uniform);
    let running = 0;
    for (let index = 0; index < uniform.length; index += 1) {
      running += uniform[index];
      expect(latest[index]).toBeLessThanOrEqual(running);
    }
  });

  it('keeps the early periods light and the late ones heavy', () => {
    const latest = latestStartCumulative(uniform);
    // The ramp is quadratic: the first period is far below the average
    // share and the last one far above it, so the curve is back-heavy.
    expect(latest[0]).toBeLessThan(1000);
    expect(latest[latest.length - 2]).toBeLessThan(9000);
  });

  it('follows a back-loaded plan without rising above it', () => {
    // A plan that already concentrates work late is its own late bound:
    // the latest-start curve is clamped to it and never crosses it.
    const schedule = [0, 0, 0, 100];
    const latest = latestStartCumulative(schedule);
    expect(latest).toEqual([0, 0, 0, 100]);
  });

  it('keeps a single-period schedule as the total itself', () => {
    expect(latestStartCumulative([500])).toEqual([500]);
  });
});

describe('latestStartSchedule', () => {
  it('is the adjacent difference of the very same cumulative curve', () => {
    const schedule = [25, 25, 25, 25];
    const cumulative = latestStartCumulative(schedule);
    expect(latestStartSchedule(schedule)).toEqual(
      cumulative.map((value, index) =>
        index === 0 ? value : value - cumulative[index - 1],
      ),
    );
  });

  it('keeps the whole total, front-light and back-heavy', () => {
    const schedule = new Array(10).fill(1000);
    const periods = latestStartSchedule(schedule);
    expect(periods).toHaveLength(10);
    expect(periods.reduce((sum, value) => sum + value, 0)).toBe(10000);
    expect(periods[0]).toBeLessThan(periods[periods.length - 1]);
  });

  it('answers empty and single-period schedules without drift', () => {
    expect(latestStartSchedule([])).toEqual([]);
    expect(latestStartSchedule([500])).toEqual([500]);
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

  it('recomputes demand for the latest-start plan while keeping overrides', () => {
    const trades = [
      { id: '1', name: 'Rebar', unitQuota: 0.2, createdAt: '', updatedAt: '' },
    ];
    // 120 over four periods gives exact one-decimal demand in both scenarios.
    const schedule = [30, 30, 30, 30];
    const earliest = laborDemand({ schedule, laborOverrides: null }, trades);
    const latest = laborDemand(
      { schedule: latestStartSchedule(schedule), laborOverrides: null },
      trades,
    );
    // Both scenarios spend the same total quantity, so their quota-based
    // labor totals converge, but the work shifts towards the final periods.
    const sum = (rows: typeof earliest) =>
      roundLabor(rows.reduce((total, row) => total + row.value, 0));
    expect(sum(latest)).toBe(sum(earliest));
    expect(latest[0].value).toBeLessThan(earliest[0].value);
    expect(latest[latest.length - 2].value).toBeGreaterThan(
      earliest[earliest.length - 2].value,
    );
    // The manual override is applied on top of whichever scenario is used.
    const overridden = laborDemand(
      {
        schedule: latestStartSchedule(schedule),
        laborOverrides: { Rebar: { '3': 99 } },
      },
      trades,
    );
    expect(overridden[3]).toMatchObject({ value: 99, override: 99 });
  });
});
