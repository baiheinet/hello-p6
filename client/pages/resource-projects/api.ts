import { useApiClient } from '@nocobase/app-client';
import { useCallback, useEffect, useState } from 'react';

import type {
  CompareProjects,
  LaborTrade,
  ResourceProject,
  ResourceProjectView,
} from './types.js';

/** Loads the project list. */
export function useProjects() {
  const api = useApiClient();
  const [result, setResult] = useState<{
    data?: ResourceProject[];
    error?: unknown;
    loading: boolean;
  }>({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    api
      .request<{ data: ResourceProject[] }>({
        path: 'resourceProjects',
        signal: controller.signal,
      })
      .then(
        ({ data }) => {
          if (!controller.signal.aborted)
            setResult({ data, loading: false });
        },
        (error: unknown) => {
          if (!controller.signal.aborted)
            setResult({ error, loading: false });
        },
      );
    return () => controller.abort();
  }, [api]);
  return result;
}

/** Loads one project's derived view (S curve and labor demand). */
export function useProjectView(projectId: string) {
  const api = useApiClient();
  const [result, setResult] = useState<{
    data?: ResourceProjectView;
    error?: unknown;
    loading: boolean;
  }>({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    setResult({ loading: true });
    api
      .request<{ data: ResourceProjectView }>({
        path: `resourceProjects/${encodeURIComponent(projectId)}`,
        signal: controller.signal,
      })
      .then(
        ({ data }) => {
          if (!controller.signal.aborted)
            setResult({ data, loading: false });
        },
        (error: unknown) => {
          if (!controller.signal.aborted)
            setResult({ error, loading: false });
        },
      );
    return () => controller.abort();
  }, [api, projectId]);
  return result;
}

/** Loads the shared trade quotas. */
export function useTrades() {
  const api = useApiClient();
  const [result, setResult] = useState<{
    data?: LaborTrade[];
    error?: unknown;
    loading: boolean;
  }>({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    api
      .request<{ data: LaborTrade[] }>({
        path: 'laborTrades',
        signal: controller.signal,
      })
      .then(
        ({ data }) => {
          if (!controller.signal.aborted)
            setResult({ data, loading: false });
        },
        (error: unknown) => {
          if (!controller.signal.aborted)
            setResult({ error, loading: false });
        },
      );
    return () => controller.abort();
  }, [api]);
  return result;
}

/**
 * Loads the compare view for the given project ids. One read per selection;
 * the ids are stable because they come from the URL.
 */
export function useCompare(ids: readonly string[]) {
  const api = useApiClient();
  const idKey = ids.join(',');
  const [result, setResult] = useState<{
    data?: CompareProjects;
    error?: unknown;
    loading: boolean;
    key: string;
  }>({ key: '', loading: false });
  useEffect(() => {
    if (!idKey) return;
    const controller = new AbortController();
    api
      .request<{ data: CompareProjects }>({
        path: `resourceProjects/compare?ids=${encodeURIComponent(idKey)}`,
        signal: controller.signal,
      })
      .then(
        ({ data }) => {
          if (!controller.signal.aborted)
            setResult({ data, loading: false, key: idKey });
        },
        (error: unknown) => {
          if (!controller.signal.aborted)
            setResult({ error, loading: false, key: idKey });
        },
      );
    return () => controller.abort();
  }, [api, idKey]);
  const loading = result.key !== idKey || result.loading;
  return {
    data: loading ? undefined : result.data,
    error: loading ? undefined : result.error,
    loading,
  };
}

/** Pins one period of a project and lets the server rebalance the rest. */
export function useAdjustPeriod() {
  const api = useApiClient();
  return useCallback(
    (projectId: string, index: number, value: number) =>
      api.request<{ data: ResourceProject }>({
        path: `resourceProjects/${encodeURIComponent(projectId)}/adjustPeriod`,
        method: 'POST',
        json: { index, value },
      }),
    [api],
  );
}

/** Sets or clears a per-period labor override on one project. */
export function useOverrideLabor() {
  const api = useApiClient();
  return useCallback(
    (projectId: string, trade: string, index: number, value: number | null) =>
      api.request<{ data: ResourceProject }>({
        path: `resourceProjects/${encodeURIComponent(projectId)}/overrideLabor`,
        method: 'POST',
        json: { trade, index, value },
      }),
    [api],
  );
}

/** Creates a project with an even schedule. */
export function useCreateProject() {
  const api = useApiClient();
  return useCallback(
    (input: {
      name: string;
      totalQuantity: number;
      periodCount: number;
      startDate: string;
      endDate: string;
    }) =>
      api.request<{ data: ResourceProject }>({
        path: 'resourceProjects',
        method: 'POST',
        json: input,
      }),
    [api],
  );
}

/** Saves one quota of the shared trade table (create or update by name). */
export function useSaveTradeQuota() {
  const api = useApiClient();
  return useCallback(
    async (input: { name: string; unitQuota: number }) => {
      const existing = await api.request<{ data: LaborTrade[] }>({
        path: 'laborTrades',
      });
      const match = existing.data.find((t) => t.name === input.name);
      if (match)
        return api.request<{ data: LaborTrade }>({
          path: `laborTrades/${encodeURIComponent(match.id)}`,
          method: 'PATCH',
          json: { unitQuota: input.unitQuota },
        });
      return api.request<{ data: LaborTrade }>({
        path: 'laborTrades',
        method: 'POST',
        json: input,
      });
    },
    [api],
  );
}
