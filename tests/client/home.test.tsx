import { answerApi, renderWithApp } from '@nocobase/app-testing/client';
import { apiClientToken } from '@nocobase/app-client';
import {
  AuthorizationClient,
  authorizationClientToken,
  type AuthorizationSnapshot,
} from '@nocobase/app-plugin-authorization/client';
import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import packageMetadata from '../../package.json' with { type: 'json' };
import enUS from '../../client/locales/en-US.js';
import HomePage from '../../client/pages/home/index.js';
import { todayIso } from '../../client/pages/home/overview.js';
import type { ResourceProject } from '../../client/pages/resource-projects/types.js';

const projectsGrant = {
  resource: { type: 'page', id: 'resourceProjects' },
  actions: ['access'],
} as const;
const tradeQuotasGrant = {
  resource: { type: 'settings', id: 'resourcePlanning.tradeQuotas' },
  actions: ['read'],
} as const;

const granted: AuthorizationSnapshot = {
  unrestricted: false,
  permissions: [projectsGrant, tradeQuotasGrant],
};
const projectsOnly: AuthorizationSnapshot = {
  unrestricted: false,
  permissions: [projectsGrant],
};
const quotasOnly: AuthorizationSnapshot = {
  unrestricted: false,
  permissions: [tradeQuotasGrant],
};
const nothingGranted: AuthorizationSnapshot = {
  unrestricted: false,
  permissions: [],
};

function day(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return todayIso(date);
}

const projects: ResourceProject[] = [
  {
    id: 'alpha',
    name: 'Alpha bridge',
    totalQuantity: 120,
    periodCount: 4,
    startDate: day(-10),
    endDate: day(10),
    schedule: [30, 30, 30, 30],
    laborOverrides: null,
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-16T09:00:00.000Z',
  },
  {
    id: 'beta',
    name: 'Beta tunnel',
    totalQuantity: 80,
    periodCount: 4,
    startDate: day(5),
    endDate: day(25),
    schedule: [20, 20, 20, 20],
    laborOverrides: null,
    createdAt: '2026-11-02T08:00:00.000Z',
    updatedAt: '2026-11-15T09:00:00.000Z',
  },
  {
    id: 'gamma',
    name: 'Gamma road',
    totalQuantity: 60,
    periodCount: 3,
    startDate: day(-30),
    endDate: day(-1),
    schedule: [20, 20, 20],
    laborOverrides: null,
    createdAt: '2026-11-03T08:00:00.000Z',
    updatedAt: '2026-11-14T09:00:00.000Z',
  },
];

function renderHome(
  options: {
    readonly permissions?:
      | AuthorizationSnapshot
      | (() => AuthorizationSnapshot | Promise<AuthorizationSnapshot>);
    readonly projectsResponse?: unknown;
  } = {},
) {
  const readPermissions = options.permissions ?? granted;
  return renderWithApp(<HomePage />, {
    namespace: packageMetadata.name,
    namespaces: { [packageMetadata.name]: enUS },
    fetch: answerApi(({ path }) => {
      if (path === 'authorization/permissions')
        return {
          data:
            typeof readPermissions === 'function'
              ? readPermissions()
              : readPermissions,
        };
      if (path === 'resourceProjects')
        return (
          options.projectsResponse ?? {
            data: projects,
            meta: { total: projects.length },
          }
        );
      return new Response(null, { status: 404 });
    }),
    services: (app) => {
      app.container.singleton(
        authorizationClientToken,
        (resolver) => new AuthorizationClient(resolver.resolve(apiClientToken)),
      );
    },
  });
}

function cardOf(label: string, scope: HTMLElement): HTMLElement {
  const card = within(scope)
    .getByText(label)
    .closest<HTMLElement>('[data-slot="card"]');
  if (!card) throw new Error(`No card for ${label}`);
  return card;
}

describe('home workbench', () => {
  it('shows construction resource planning with figures from the real project list', async () => {
    await renderHome();

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: enUS.home.title,
      }),
    ).toBeVisible();
    expect(screen.getByText(enUS.home.eyebrow)).toBeVisible();

    const overview = await screen.findByRole('region', {
      name: enUS.home.overview.title,
    });
    await waitFor(() =>
      expect(
        cardOf(enUS.home.overview.totalProjects, overview),
      ).toHaveTextContent('3'),
    );
    // Only Alpha's schedule covers today; Beta starts later and Gamma has ended.
    await waitFor(() =>
      expect(cardOf(enUS.home.overview.inProgress, overview)).toHaveTextContent(
        '1',
      ),
    );

    const recent = within(overview)
      .getAllByRole('link')
      .filter((link) =>
        link.getAttribute('href')?.startsWith('/resource-projects/'),
      );
    expect(recent.map((link) => link.textContent)).toEqual([
      'Alpha bridge',
      'Beta tunnel',
      'Gamma road',
    ]);
    expect(recent[0]).toHaveAttribute('href', '/resource-projects/alpha');
    expect(
      within(overview).getByRole('link', {
        name: enUS.home.overview.viewAll,
      }),
    ).toHaveAttribute('href', '/resource-projects');
  });

  it('leads to new project, the project list, trade quotas and the comparison', async () => {
    await renderHome();

    expect(
      await screen.findByRole('link', { name: /New project/ }),
    ).toHaveAttribute('href', '/resource-projects/new');
    expect(screen.getByRole('link', { name: /Project list/ })).toHaveAttribute(
      'href',
      '/resource-projects',
    );
    expect(
      screen.getByRole('link', { name: /Compare projects/ }),
    ).toHaveAttribute('href', '/resource-projects/compare');
    expect(
      screen.getByRole('link', { name: /Trade labor quotas/ }),
    ).toHaveAttribute('href', '/resource-planning/trades');
  });

  it('shows an authorized viewer only the modules their page grants allow', async () => {
    await renderHome({ permissions: projectsOnly });

    expect(
      await screen.findByRole('link', { name: /New project/ }),
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: /Trade labor quotas/ }),
    ).not.toBeInTheDocument();
  });

  it('keeps the quota entry without project figures when only quotas are granted', async () => {
    await renderHome({ permissions: quotasOnly });

    expect(
      await screen.findByRole('link', { name: /Trade labor quotas/ }),
    ).toBeVisible();
    expect(
      screen.queryByRole('region', { name: enUS.home.overview.title }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /New project/ }),
    ).not.toBeInTheDocument();
  });

  it('renders without errors and without dead links when no business page is granted', async () => {
    await renderHome({ permissions: nothingGranted });

    expect(await screen.findByText(enUS.home.restricted.title)).toBeVisible();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('removes the business entry when the permission snapshot is revoked', async () => {
    let permissions: AuthorizationSnapshot = granted;
    const view = await renderHome({ permissions: () => permissions });
    expect(
      await screen.findByRole('link', { name: /New project/ }),
    ).toBeVisible();

    const authorization = view.app.container.resolve(authorizationClientToken);
    await act(async () => {
      permissions = nothingGranted;
      authorization.invalidate();
      await authorization.snapshot();
    });

    expect(await screen.findByText(enUS.home.restricted.title)).toBeVisible();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('keeps the quick entries and explains a denied project read', async () => {
    await renderHome({
      projectsResponse: new Response(null, { status: 403 }),
    });

    expect(
      await screen.findByText(enUS.home.overview.unavailable),
    ).toBeVisible();
    // The stat cards must leave their loading skeletons for a visible placeholder.
    const overview = screen.getByRole('region', {
      name: enUS.home.overview.title,
    });
    for (const label of [
      enUS.home.overview.totalProjects,
      enUS.home.overview.inProgress,
    ]) {
      const card = cardOf(label, overview);
      expect(card).toHaveTextContent('—');
      expect(card).toHaveTextContent(enUS.home.overview.unavailableValue);
    }
    expect(screen.getByRole('link', { name: /New project/ })).toHaveAttribute(
      'href',
      '/resource-projects/new',
    );
  });

  it('invites the first project when the list is empty', async () => {
    await renderHome({
      projectsResponse: { data: [], meta: { total: 0 } },
    });

    expect(
      await screen.findByText(enUS.home.overview.noProjects),
    ).toBeVisible();
    expect(
      cardOf(
        enUS.home.overview.totalProjects,
        screen.getByRole('region', {
          name: enUS.home.overview.title,
        }),
      ),
    ).toHaveTextContent('0');
  });
});
