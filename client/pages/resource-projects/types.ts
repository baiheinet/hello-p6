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
  readonly laborOverrides:
    | { readonly [trade: string]: { readonly [index: string]: number | null } }
    | null;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface ResourceProjectView extends ResourceProject {
  /** Cumulative planned quantity, one value per period. */
  readonly cumulative: readonly number[];
  /** One row per trade: its per-period labor demand with overrides applied. */
  readonly labor: readonly {
    readonly trade: string;
    readonly periods: readonly number[];
  }[];
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
