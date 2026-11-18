// The compare entry on the project pages: the list page shows a header button and the row action only when the
// viewer may open the `resourceProjectCompare` route, and shows nothing while the permission check is still
// running — no dead link. The same `useCompareEntryVisible` hook drives the detail page's entry.
import {
  answerApi,
  renderWithApp,
  type ApiCall,
} from '@nocobase/app-testing/client';
import type { AppClientRegisteredRoute } from '@nocobase/app-client/plugins';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RouteTreeProvider } from '../../client/routing/route-context.js';
import { routeKey } from '../../client/routing/route-navigation.js';
import enUS from '../../client/locales/en-US.js';
import packageMetadata from '../../package.json' with { type: 'json' };

const { default: ResourceProjectsPage } =
  await import('../../client/pages/resource-projects/index.js');

const compareRoute: AppClientRegisteredRoute = {
  id: 'resourceProjectCompare',
  name: 'resourceProjectCompare',
  path: 'compare',
  packageName: packageMetadata.name,
  source: 'application',
  auth: 'required',
  authz: {
    resource: { type: 'page', id: 'resourceProjects' },
    action: 'access',
  },
  componentLoader: async () => ({ default: () => null }),
};
const routes: AppClientRegisteredRoute[] = [
  {
    id: 'resourceProjects',
    name: 'resourceProjects',
    path: '/resource-projects',
    packageName: packageMetadata.name,
    source: 'application',
    auth: 'required',
    authz: {
      resource: { type: 'page', id: 'resourceProjects' },
      action: 'access',
    },
    children: [
      {
        id: 'resourceProjectNew',
        name: 'resourceProjectNew',
        path: 'new',
        packageName: packageMetadata.name,
        source: 'application',
        auth: 'required',
        authz: {
          resource: { type: 'page', id: 'resourceProjects' },
          action: 'access',
        },
        componentLoader: async () => ({ default: () => null }),
      },
      compareRoute,
      {
        id: 'resourceProjectDetail',
        name: 'resourceProjectDetail',
        path: ':projectId',
        packageName: packageMetadata.name,
        source: 'application',
        auth: 'required',
        authz: {
          resource: { type: 'page', id: 'resourceProjects' },
          action: 'access',
        },
        componentLoader: async () => ({ default: () => null }),
      },
    ],
    componentLoader: async () => ({ default: () => null }),
  },
];

let projects: unknown[] = [];

const api = vi.fn(({ method, path }: ApiCall) => {
  if (method === 'GET' && path === 'resourceProjects')
    return { data: projects };
  return new Response(null, { status: 404 });
});

async function renderList(access: { denied: Set<string>; loading: boolean }) {
  return renderWithApp(
    <RouteTreeProvider routes={routes} access={access}>
      <ResourceProjectsPage />
    </RouteTreeProvider>,
    {
      route: '/resource-projects',
      namespace: packageMetadata.name,
      namespaces: { [packageMetadata.name]: enUS },
      fetch: answerApi(api),
    },
  );
}

describe('the compare entry on the project list page', () => {
  it('shows the entry when the viewer may open the compare route', async () => {
    projects = [
      {
        id: '1',
        name: 'Alpha',
        totalQuantity: 10,
        periodCount: 2,
        startDate: '2026-11-01',
        endDate: '2026-12-31',
      },
    ];
    await renderList({ denied: new Set(), loading: false });
    await waitFor(() => expect(api).toHaveBeenCalled());

    // Presence is the contract here: the button is a `render={<Link to='../compare' />}` anchor whose target
    // resolves through the app's router, which the create-flow and navigation coverage already exercise.
    expect(
      await screen.findByRole('button', { name: 'Compare projects' }),
    ).toBeInTheDocument();
  });

  it('hides the entry while the permission check is running', async () => {
    projects = [];
    await renderList({ denied: new Set(), loading: true });
    await waitFor(() => expect(api).toHaveBeenCalled());

    expect(
      screen.queryByRole('button', { name: 'Compare projects' }),
    ).not.toBeInTheDocument();
  });

  it('hides the entry when the viewer may not open the compare route', async () => {
    projects = [];
    await renderList({
      denied: new Set([routeKey(compareRoute)]),
      loading: false,
    });

    // The list itself has finished loading (its empty state is shown), so the missing entry is the access check's
    // doing, not the permission check still running.
    expect(await screen.findByText('No data yet')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Compare projects' }),
    ).not.toBeInTheDocument();
  });
});
