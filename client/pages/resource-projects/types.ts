/** The resource-planning endpoint contracts shared by the pages. */

export interface ResourceProject {
  readonly id: string;
  readonly name: string;
  readonly totalQuantity: number;
  readonly periodCount: number;
  /** A calendar date, `yyyy-MM-dd`. */
  readonly startDate: string;
  readonly endDate: string;
  /** The planned quantity for each period, in period order. */
  readonly schedule: readonly number[];
  /**
   * Manual per-period labor overrides, a map of trade name to a map of
   * period index (as a string) to the overridden headcount; a `null` value
   * clears the override.
   */
  readonly laborOverrides: {
    readonly [trade: string]: { readonly [index: string]: number | null };
  } | null;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

/** One trade's per-period labor demand, with manual overrides applied. */
export interface LaborRow {
  readonly trade: string;
  readonly periods: readonly number[];
}

export interface ResourceProjectView extends ResourceProject {
  /** Cumulative planned quantity, one value per period. */
  readonly cumulative: readonly number[];
  /**
   * The banana curve's "latest start" cumulative output, one value per
   * period: the same total spread front-light and back-heavy, ending at the
   * schedule's total.
   */
  readonly latestStartCumulative: readonly number[];
  /**
   * The "latest start" plan's per-period quantity, the adjacent differences
   * of `latestStartCumulative`. It shares the S curve's quantity basis.
   */
  readonly latestStartSchedule: readonly number[];
  /** Labor demand from the current (earliest start) schedule. */
  readonly labor: readonly LaborRow[];
  /**
   * Labor demand from the "latest start" per-period quantity, with the same
   * trade quotas and manual overrides applied on top.
   */
  readonly laborLatestStart: readonly LaborRow[];
}

export interface LaborTrade {
  readonly id: string;
  readonly name: string;
  /** Workforce per unit of quantity, in people. */
  readonly unitQuota: number;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface CompareProjects {
  readonly projects: readonly ResourceProjectView[];
  /** One label per project, in the order of `projects`. */
  readonly labels: readonly string[];
}
