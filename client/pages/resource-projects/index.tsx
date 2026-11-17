import { resolveListState, useApiClient } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Link, Outlet } from 'react-router';
import { PlusIcon, Rows3Icon } from 'lucide-react';
import { type ColumnDef, type Row } from '@tanstack/react-table';

import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { DataTable, DataTableColumnHeader } from '#components/data-table';
import { ListFeedback } from '#components/list-feedback';
import { RowActions } from '#components/row-actions';
import { Button } from '#components/ui/button';
import { useRouteAccess, useRouteTree } from '../../routing/route-context.js';
import { routeKey } from '../../routing/route-navigation.js';

import type { ResourceProject } from './types.js';

export default function ResourceProjectsPage(): ReactElement {
  const { t } = useTranslation();
  const request = useProjects();
  const columns = useProjectColumns();
  const canOpenCompare = useCompareEntryVisible();
  const listState = resolveListState(
    {
      data: request.data?.data,
      error: request.error,
      isPending: request.loading,
    },
    (request.data?.data ?? []).length,
    false,
  );

  return (
    <PageContainer>
      <PageHeader
        title={t('resourcePlanning.title')}
        description={t('resourcePlanning.description')}
        actions={
          <>
            {canOpenCompare ? (
              <Button
                variant='outline'
                nativeButton={false}
                render={<Link to='compare' />}
              >
                <Rows3Icon data-icon='inline-start' />
                {t('resourcePlanning.compareEntry')}
              </Button>
            ) : null}
            <Button nativeButton={false} render={<Link to='new' />}>
              <PlusIcon data-icon='inline-start' />
              {t('resourcePlanning.newProject')}
            </Button>
          </>
        }
      />
      <ListFeedback state={listState}>
        <DataTable
          columns={columns}
          data={request.data?.data ?? []}
          getRowId={(row) => row.id}
          pagination={false}
          loading={request.loading && listState === 'ready'}
          listState={listState}
          onRetry={request.reload}
          emptyMessage={t('resourcePlanning.emptyProjects')}
          summary={
            request.data?.data
              ? t('resourcePlanning.projectCount', {
                  count: request.data.data.length,
                })
              : undefined
          }
        />
      </ListFeedback>
      <Outlet />
    </PageContainer>
  );
}

/**
 * Whether the "Compare projects" entry may show on this page. The compare route is registered under the
 * `resourceProjects` page, so it carries the same access as the list and detail pages that host this button.
 * A viewer who may not open the module page sees no entry, and no dead link. While the permission check is
 * still running the entry is hidden rather than risked as a dead link.
 */
function useCompareEntryVisible(): boolean {
  const { denied, loading } = useRouteAccess();
  const routes = useRouteTree();
  if (loading) return false;
  const compare = routes
    .find((route) => route.name === 'resourceProjects')
    ?.children?.find((child) => child.name === 'resourceProjectCompare');
  if (!compare) return false;
  return !denied.has(routeKey(compare));
}

function useProjects() {
  const api = useApiClient();
  const [result, setResult] = useState<{
    data?: { data: ResourceProject[]; meta: { total: number } };
    error?: unknown;
    loading: boolean;
    revision: number;
  }>({ loading: true, revision: 0 });
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => {
    setReloadKey((value) => value + 1);
    setResult((value) => ({
      ...value,
      loading: true,
      revision: value.revision + 1,
    }));
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    api
      .request<{ data: ResourceProject[]; meta: { total: number } }>({
        path: 'resourceProjects',
        signal: controller.signal,
      })
      .then(
        ({ data }) => {
          if (!controller.signal.aborted)
            setResult({
              data: { data, meta: { total: data.length } },
              loading: false,
              revision: reloadKey,
            });
        },
        (error: unknown) => {
          if (!controller.signal.aborted)
            setResult({
              error,
              loading: false,
              revision: reloadKey,
            });
        },
      );
    return () => controller.abort();
  }, [api, reloadKey]);
  return { ...result, reload };
}

function useProjectColumns(): ColumnDef<ResourceProject>[] {
  const { t } = useTranslation();
  return [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('resourcePlanning.projectName')}
        />
      ),
      cell: ({ row }) => (
        <Link to={`/resource-projects/${row.original.id}`}>
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: 'totalQuantity',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('resourcePlanning.totalQuantity')}
        />
      ),
    },
    {
      accessorKey: 'periodCount',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('resourcePlanning.periodCount')}
        />
      ),
    },
    {
      accessorKey: 'startDate',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('resourcePlanning.startDate')}
        />
      ),
    },
    {
      id: 'actions',
      enableSorting: false,
      cell: ({ row }) => <ProjectActions row={row} />,
    },
  ];
}

function ProjectActions({ row }: { row: Row<ResourceProject> }): ReactElement {
  const { t } = useTranslation();
  const project = row.original;
  const canOpenCompare = useCompareEntryVisible();
  return (
    <RowActions
      label={t('resourcePlanning.actionsFor', { name: project.name })}
      actions={[
        {
          key: 'open',
          label: t('resourcePlanning.actionOpen'),
          render: (
            <Link to={`/resource-projects/${project.id}`}>
              {t('resourcePlanning.actionOpen')}
            </Link>
          ),
        },
        canOpenCompare
          ? {
              key: 'compare',
              label: t('resourcePlanning.actionCompare'),
              render: (
                <Link to={`/resource-projects/compare?ids=${project.id}`}>
                  {t('resourcePlanning.actionCompare')}
                </Link>
              ),
            }
          : null,
      ]}
    />
  );
}
