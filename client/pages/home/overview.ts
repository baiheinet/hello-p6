import type { ResourceProject } from '../resource-projects/types.js';

/** How many recently updated projects the workbench lists. */
export const RECENT_PROJECT_LIMIT = 3;

/**
 * The overview the home workbench shows, derived from the same list the
 * projects page loads so both always report the same figures.
 */
export interface ProjectOverview {
  readonly total: number;
  /** Projects whose schedule covers today: `startDate <= today <= endDate`. */
  readonly inProgress: number;
  /** The most recently updated projects, newest first. */
  readonly recent: readonly ResourceProject[];
}

/** Today's calendar date as `yyyy-MM-dd`, in the viewer's own time zone. */
export function todayIso(now: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * A project is in progress while today falls inside its schedule. An empty
 * start or end date cannot be placed on the timeline, so it never counts.
 */
export function isInProgress(project: ResourceProject, today: string): boolean {
  return (
    Boolean(project.startDate) &&
    Boolean(project.endDate) &&
    project.startDate <= today &&
    today <= project.endDate
  );
}

/** Sorts by the last update and falls back to creation and then name, so the order is stable. */
function lastTouched(project: ResourceProject): string {
  return project.updatedAt ?? project.createdAt ?? '';
}

export function projectOverview(
  projects: readonly ResourceProject[],
  today: string,
): ProjectOverview {
  const recent = [...projects]
    .sort(
      (left, right) =>
        lastTouched(right).localeCompare(lastTouched(left)) ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id),
    )
    .slice(0, RECENT_PROJECT_LIMIT);
  return {
    total: projects.length,
    inProgress: projects.filter((project) => isInProgress(project, today))
      .length,
    recent,
  };
}
