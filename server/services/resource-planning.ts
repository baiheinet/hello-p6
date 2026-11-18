import { ApiError } from '@nocobase/app-server';
import { type DatabaseManager, type Repository } from '@nocobase/db';

export interface ResourceProject {
  readonly id: string;
  readonly name: string;
  readonly totalQuantity: number;
  readonly periodCount: number;
  readonly startDate: string;
  readonly endDate: string;
  /** Planned quantity for each period, in period order. */
  readonly schedule: readonly number[];
  /**
   * Manual per-period labor overrides: a map of trade name to a map of period
   * index (as a string) to the overridden headcount; `null` clears one.
   */
  readonly laborOverrides: Readonly<
    Record<string, Record<string, number | null>>
  > | null;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface LaborTrade {
  readonly id: string;
  readonly name: string;
  /** Workforce per unit of quantity (people). */
  readonly unitQuota: number;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

/**
 * Builds the project repositories from the database. The route decides which
 * policy to bind; the factory stays free of Hono and status codes.
 */
export function resourcePlanningRepositories(database: DatabaseManager): {
  readonly projects: Repository<ResourceProject>;
  readonly trades: Repository<LaborTrade>;
} {
  return {
    projects: database.repository<ResourceProject>('resourceProjects'),
    trades: database.repository<LaborTrade>('laborTrades'),
  };
}

/** Cumulative planned quantity for each period, used to draw the S curve. */
export function cumulativeSeries(schedule: readonly number[]): number[] {
  let total = 0;
  return schedule.map((quantity) => {
    total += quantity;
    return total;
  });
}

/**
 * The cumulative output of the banana curve's "latest start" plan: the same
 * total quantity as the project's schedule, spread over the same periods by
 * a quadratic ramp `w(i) = (i + 1)²`, so early periods carry little output
 * and the later ones concentrate the work (front-light, back-heavy). The
 * ramp is clamped below the project's own cumulative curve, so the two
 * curves never cross and the plan's float reads as the band between them;
 * both curves reach the schedule's total in the final period.
 */
export function latestStartCumulative(schedule: readonly number[]): number[] {
  const count = schedule.length;
  if (count === 0) return [];
  const total = schedule.reduce((sum, value) => sum + value, 0);
  const weights = Array.from(
    { length: count },
    (_, index) => (index + 1) * (index + 1),
  );
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const ramp: number[] = [];
  let rampSum = 0;
  for (let index = 0; index < count; index += 1) {
    rampSum += (total * weights[index]) / weightSum;
    ramp.push(rampSum);
  }
  ramp[count - 1] = total;
  const earliest = cumulativeSeries(schedule);
  return ramp.map((value, index) => Math.min(value, earliest[index]));
}

/**
 * The "latest start" plan's per-period quantity: the adjacent differences of
 * the very same cumulative curve the banana chart draws, so the S curve and
 * every scenario-derived figure share one quantity basis. The values sum to
 * the schedule's total and are front-light, back-heavy like the curve.
 */
export function latestStartSchedule(schedule: readonly number[]): number[] {
  const cumulative = latestStartCumulative(schedule);
  return cumulative.map((value, index) =>
    index === 0 ? value : value - cumulative[index - 1],
  );
}

/**
 * Splits the total quantity evenly across `count` periods. When it does not
 * divide evenly, the earlier periods carry one extra unit and the last
 * period absorbs the remainder, so the values sum to the total exactly even
 * for fractional totals.
 */
export function evenSchedule(total: number, count: number): number[] {
  if (count < 1) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  const values = new Array<number>(count).fill(base);
  let claimed = 0;
  for (let index = 0; index < count; index += 1) {
    if (index === count - 1) {
      values[index] = total - claimed;
    } else {
      const value = base + (index < remainder ? 1 : 0);
      values[index] = value;
      claimed += value;
    }
  }
  return values;
}

/**
 * Rebalances the schedule around one user-fixed period: the fixed period
 * keeps its value, the total is preserved, and the remaining quantity is
 * spread evenly across the other periods. The last remaining period absorbs
 * the rounding so the total never drifts.
 */
export function rebalance(
  schedule: readonly number[],
  fixedIndex: number,
  fixedValue: number,
): number[] {
  const count = schedule.length;
  if (count === 0) return [];
  if (fixedIndex < 0 || fixedIndex >= count)
    throw new ApiError({
      status: 'INVALID_ARGUMENT',
      reason: 'PERIOD_OUT_OF_RANGE',
      domain: 'resourcePlanning',
      message: `Period ${fixedIndex} is not in the schedule.`,
    });
  const total = schedule.reduce((sum, value) => sum + value, 0);
  const others = count - 1;
  if (others === 0) {
    if (total !== fixedValue)
      throw new ApiError({
        status: 'FAILED_PRECONDITION',
        reason: 'TOTAL_MISMATCH',
        domain: 'resourcePlanning',
        message: 'The fixed period no longer matches the total.',
      });
    return [fixedValue];
  }
  const remaining = total - fixedValue;
  if (remaining < 0)
    throw new ApiError({
      status: 'INVALID_ARGUMENT',
      reason: 'PERIOD_EXCEEDS_TOTAL',
      domain: 'resourcePlanning',
      message: 'The fixed period cannot exceed the total quantity.',
    });
  const base = Math.floor(remaining / others);
  const remainder = remaining - base * others;
  const next = new Array<number>(count).fill(0);
  next[fixedIndex] = fixedValue;
  let claimed = 0;
  let unfixedSeen = 0;
  for (let index = 0; index < count; index += 1) {
    if (index === fixedIndex) continue;
    unfixedSeen += 1;
    if (unfixedSeen === others) {
      next[index] = remaining - claimed;
    } else {
      const value = base + (unfixedSeen <= remainder ? 1 : 0);
      next[index] = value;
      claimed += value;
    }
  }
  return next;
}

/** One period of one project, with its index and timeline position. */
export interface ProjectPeriod {
  readonly index: number;
  readonly label: string;
  readonly quantity: number;
  readonly cumulative: number;
}

/** The labor requirement of one period for one trade. */
export interface PeriodLabor {
  readonly trade: string;
  readonly periodIndex: number;
  readonly quantity: number;
  readonly override: number | null;
  readonly value: number;
}

/**
 * Builds the per-period labor demand for one project: quantity × the global
 * quota of each trade, with the project's manual overrides applied on top.
 */
export function laborDemand(
  project: Pick<ResourceProject, 'schedule' | 'laborOverrides'>,
  trades: readonly LaborTrade[],
): PeriodLabor[] {
  const rows: PeriodLabor[] = [];
  for (const trade of trades) {
    const overrideFor = project.laborOverrides?.[trade.name] ?? null;
    for (let index = 0; index < project.schedule.length; index += 1) {
      const quantity = project.schedule[index] ?? 0;
      const overridden = overrideFor?.[String(index)];
      rows.push({
        trade: trade.name,
        periodIndex: index,
        quantity,
        override: overridden == null ? null : overridden,
        value:
          overridden == null
            ? roundLabor(quantity * trade.unitQuota)
            : overridden,
      });
    }
  }
  return rows;
}

/** Rounds a labor value to one decimal so charts and tables match. */
export function roundLabor(value: number): number {
  return Math.round(value * 10) / 10;
}

/** The month label of period `index` counted from the project's start. */
export function periodLabel(index: number, startDate: string): string {
  const start = new Date(startDate);
  start.setMonth(start.getMonth() + index);
  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export interface ResourcePlanningService {
  /** The projects repository; the route binds its own policy. */
  readonly projects: Repository<ResourceProject>;
  /** The shared trade-quota repository; the route binds its own policy. */
  readonly trades: Repository<LaborTrade>;
}
