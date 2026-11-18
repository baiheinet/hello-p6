/** A labor row exactly as the project view supplies it from `laborDemand`. */
export interface LaborRow {
  readonly trade: string;
  readonly periods: readonly number[];
}

export interface LaborTotals {
  /** One total per period: the sum across every trade. */
  readonly period: readonly number[];
  /** Each trade's total across all periods, keyed by trade name. */
  readonly trade: Readonly<Record<string, number>>;
  /** The grand total across every trade and every period. */
  readonly grand: number;
}

/** The server rounds each demand value to one decimal; sums follow the same precision. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Sums the already-computed labor demand — never recomputes it — so the table
 * footer and the trade totals always match the cells the user can see and edit.
 */
export function laborTotals(
  rows: readonly LaborRow[],
  periodCount: number,
): LaborTotals {
  const period = Array.from({ length: periodCount }, (_, index) =>
    round(rows.reduce((sum, row) => sum + (row.periods[index] ?? 0), 0)),
  );
  const trade: Record<string, number> = {};
  for (const row of rows) {
    trade[row.trade] = round(
      row.periods.reduce((sum, value) => sum + value, 0),
    );
  }
  const grand = round(
    rows.reduce(
      (sum, row) =>
        sum + row.periods.reduce((rowSum, value) => rowSum + value, 0),
      0,
    ),
  );
  return { period, trade, grand };
}
