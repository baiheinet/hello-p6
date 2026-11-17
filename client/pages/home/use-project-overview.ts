import { useApiClient } from '@nocobase/app-client';
import { useEffect, useState } from 'react';

import type { ResourceProject } from '../resource-projects/types.js';

export interface ProjectOverviewState {
  readonly projects?: readonly ResourceProject[];
  readonly loading: boolean;
  readonly error?: unknown;
}

/**
 * Loads the project list for the home overview, and only when the viewer may
 * open the projects page. The endpoint still enforces its own data
 * permission, so a denial arrives as `error` rather than a broken page.
 */
export function useProjectOverview(enabled: boolean): ProjectOverviewState {
  const api = useApiClient();
  const [result, setResult] = useState<{
    readonly key: string;
    readonly data?: readonly ResourceProject[];
    readonly error?: unknown;
  }>({ key: '' });

  const requestKey = enabled ? 'projects' : '';

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    api
      .request<{ data: ResourceProject[] }>({
        path: 'resourceProjects',
        signal: controller.signal,
      })
      .then(
        ({ data }) => {
          if (!controller.signal.aborted) setResult({ key: requestKey, data });
        },
        (error: unknown) => {
          if (!controller.signal.aborted) setResult({ key: requestKey, error });
        },
      );
    return () => controller.abort();
  }, [api, enabled, requestKey]);

  const current = result.key === requestKey;
  return {
    projects: current ? result.data : undefined,
    error: current ? result.error : undefined,
    loading: enabled && !current,
  };
}
