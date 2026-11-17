import { describe, expect, it } from 'vitest';

import {
  isInProgress,
  projectOverview,
  todayIso,
} from '../../client/pages/home/overview.js';
import type { ResourceProject } from '../../client/pages/resource-projects/types.js';

const today = '2026-11-17';

function project(
  overrides: Partial<ResourceProject> & Pick<ResourceProject, 'id' | 'name'>,
): ResourceProject {
  return {
    totalQuantity: 10,
    periodCount: 2,
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    schedule: [5, 5],
    laborOverrides: null,
    ...overrides,
  };
}

describe('project overview', () => {
  it('counts a project as in progress on both schedule boundaries', () => {
    expect(
      isInProgress(project({ id: 'a', name: 'A', startDate: today }), today),
    ).toBe(true);
    expect(
      isInProgress(project({ id: 'b', name: 'B', endDate: today }), today),
    ).toBe(true);
    expect(
      isInProgress(
        project({ id: 'c', name: 'C', startDate: today, endDate: today }),
        today,
      ),
    ).toBe(true);
  });

  it('excludes projects that have not started, have ended, or lack a date', () => {
    expect(
      isInProgress(
        project({
          id: 'a',
          name: 'A',
          startDate: '2026-11-18',
          endDate: '2026-12-01',
        }),
        today,
      ),
    ).toBe(false);
    expect(
      isInProgress(
        project({
          id: 'b',
          name: 'B',
          startDate: '2026-10-01',
          endDate: '2026-11-16',
        }),
        today,
      ),
    ).toBe(false);
    expect(
      isInProgress(
        project({ id: 'c', name: 'C', startDate: '', endDate: '2026-12-01' }),
        today,
      ),
    ).toBe(false);
    expect(
      isInProgress(
        project({ id: 'd', name: 'D', startDate: '2026-11-01', endDate: '' }),
        today,
      ),
    ).toBe(false);
  });

  it('counts every loaded project and lists the three most recently updated', () => {
    const projects = [
      project({
        id: 'old',
        name: 'Old',
        updatedAt: '2026-11-10T09:00:00.000Z',
      }),
      project({
        id: 'newest',
        name: 'Newest',
        updatedAt: '2026-11-16T09:00:00.000Z',
      }),
      project({
        id: 'middle',
        name: 'Middle',
        updatedAt: '2026-11-14T09:00:00.000Z',
      }),
      project({
        id: 'fourth',
        name: 'Fourth',
        updatedAt: '2026-11-12T09:00:00.000Z',
      }),
    ];

    const overview = projectOverview(projects, today);
    expect(overview.total).toBe(4);
    expect(overview.recent.map((entry) => entry.id)).toEqual([
      'newest',
      'middle',
      'fourth',
    ]);
  });

  it('falls back to creation time and then name when an update is missing', () => {
    const projects = [
      project({ id: 'b', name: 'B', createdAt: '2026-11-10T09:00:00.000Z' }),
      project({ id: 'a', name: 'A', createdAt: '2026-11-10T09:00:00.000Z' }),
      project({ id: 'c', name: 'C' }),
    ];

    expect(
      projectOverview(projects, today).recent.map((entry) => entry.id),
    ).toEqual(['a', 'b', 'c']);
  });

  it('formats today as a local calendar date', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(todayIso(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });
});
