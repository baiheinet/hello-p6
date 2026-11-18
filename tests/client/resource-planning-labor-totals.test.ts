import { describe, expect, it } from 'vitest';

import { laborTotals } from '../../client/pages/resource-projects/labor-totals.js';

describe('labor demand totals', () => {
  it('sums each period, each trade and the grand total', () => {
    const rows = [
      { trade: '普工', periods: [12, 12, 12, 12] },
      { trade: '钢筋工', periods: [3, 3, 3, 3] },
    ];
    const totals = laborTotals(rows, 4);

    expect(totals.period).toEqual([15, 15, 15, 15]);
    expect(totals.trade).toEqual({ 普工: 48, 钢筋工: 12 });
    expect(totals.grand).toBe(60);
    // The grand total is exactly the sum of every displayed cell.
    expect(totals.grand).toBe(
      rows.flatMap((row) => row.periods).reduce((sum, value) => sum + value, 0),
    );
  });

  it('keeps one-decimal precision when values do not divide evenly', () => {
    const totals = laborTotals(
      [
        { trade: 'A', periods: [0.1, 0.2] },
        { trade: 'B', periods: [0.3, 0.4] },
      ],
      2,
    );

    expect(totals.period).toEqual([0.4, 0.6]);
    expect(totals.trade).toEqual({ A: 0.3, B: 0.7 });
    expect(totals.grand).toBe(1);
  });

  it('reports zeroes when there is no labor demand', () => {
    expect(laborTotals([], 3)).toEqual({
      period: [0, 0, 0],
      trade: {},
      grand: 0,
    });
  });
});
