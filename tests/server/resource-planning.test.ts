import {
  DEFAULT_ADMIN_CREDENTIALS,
  signIn,
} from '@nocobase/app-plugin-authentication/testing';
import { userAdministrationServiceToken } from '@nocobase/app-plugin-authentication/server';
import { createAppTest } from '@nocobase/app-testing/server';
import { expect } from 'vitest';

import { createStandaloneServer } from '../../server/standalone.js';

/**
 * The permission boundary of the resource-planning API on a fresh
 * installation: anonymous callers get 401, an ordinary user without any
 * resource grant gets 403 on every project and trade endpoint, and the
 * administrator's root permission set still allows everything.
 */
const test = createAppTest({
  createServer: createStandaloneServer,
  connections: ['main'],
  config: {
    app: { publicOrigin: 'http://localhost' },
    auth: {
      secret: 'test-auth-secret-at-least-32-characters',
      trustedOrigins: ['http://localhost'],
    },
    users: { initialAdmin: DEFAULT_ADMIN_CREDENTIALS },
  },
});

const member = {
  name: 'Resource planner',
  email: 'resource-planner@example.test',
  password: 'test-member-password',
};

async function createMember(testApp: {
  application: import('@nocobase/app-server/application').Application;
}) {
  const userAdmin = testApp.application.container.resolve(
    userAdministrationServiceToken,
  );
  await userAdmin.create({
    name: member.name,
    email: member.email,
    password: member.password,
  });
}

async function createProject(
  fetch: (input: string, init?: RequestInit) => Promise<Response>,
): Promise<unknown> {
  const response = await fetch('/resourceProjects', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost',
    },
    body: JSON.stringify({
      name: 'Bridge deck pour',
      totalQuantity: 10000,
      periodCount: 10,
      startDate: '2026-01-01',
      endDate: '2026-10-01',
    }),
  });
  if (!response.ok)
    throw new Error(`project create failed: ${response.status}`);
  return (await response.json()).data;
}

test('answers 401 for an anonymous caller', async ({ request }) => {
  const response = await request('/resourceProjects');
  expect(response.status).toBe(401);
});

test('denies a plain member and allows the administrator', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const adminProject = await createProject((path, init) =>
    admin.fetch(path, init),
  );

  await createMember(testApp);
  const memberSession = await signIn(testApp, {
    email: member.email,
    password: member.password,
  });
  const memberFetch = (path: string, init?: RequestInit) =>
    memberSession.fetch(path, init);

  for (const path of ['/resourceProjects', '/resourceProjects/compare?ids=1']) {
    const list = await memberFetch(path);
    expect(list.status).toBe(403);
  }
  const write = await memberFetch('/resourceProjects', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost',
    },
    body: JSON.stringify({
      name: 'x',
      totalQuantity: 1,
      periodCount: 1,
      startDate: '2026-01-01',
      endDate: '2026-01-01',
    }),
  });
  expect(write.status).toBe(403);
  const tradeWrite = await memberFetch('/laborTrades', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost',
    },
    body: JSON.stringify({ name: 'Rebar', unitQuota: 0.2 }),
  });
  expect(tradeWrite.status).toBe(403);

  // The administrator still reaches everything, including the project this
  // test created.
  const adminList = await admin.fetch('/resourceProjects');
  expect(adminList.status).toBe(200);
  await expect(adminList.json()).resolves.toMatchObject({
    data: expect.arrayContaining([
      expect.objectContaining({ id: (adminProject as { id: string }).id }),
    ]),
  });
});

test('splits the total evenly and keeps it whole after an adjustment', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const project = (await createProject((path, init) =>
    admin.fetch(path, init),
  )) as { id: string; schedule: number[] };
  // 10000 / 10 = 1000 each, matching the issue's acceptance example.
  expect(project.schedule).toHaveLength(10);
  expect(project.schedule.reduce((sum, value) => sum + value, 0)).toBe(10000);
  expect(project.schedule[0]).toBe(1000);

  const adjusted = await admin.fetch(
    `/resourceProjects/${project.id}/adjustPeriod`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost',
      },
      body: JSON.stringify({ index: 3, value: 2500 }),
    },
  );
  expect(adjusted.status).toBe(200);
  const next = (await adjusted.json()).data as { schedule: number[] };
  expect(next.schedule[3]).toBe(2500);
  // The remaining 7500 spread over the other nine periods: 833, 833, 834,
  // 834, 834, 834, 834, 834, 834, so the total stays 10000.
  expect(next.schedule.reduce((sum, value) => sum + value, 0)).toBe(10000);
});

async function createTrade(
  fetch: (input: string, init?: RequestInit) => Promise<Response>,
  name: string,
  unitQuota: number,
) {
  const response = await fetch('/laborTrades', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost',
    },
    body: JSON.stringify({ name, unitQuota }),
  });
  if (!response.ok) throw new Error(`trade create failed: ${response.status}`);
  return (await response.json()).data;
}

async function createSmallProject(
  fetch: (input: string, init?: RequestInit) => Promise<Response>,
  name: string,
): Promise<{ id: string; schedule: number[] }> {
  const response = await fetch('/resourceProjects', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost',
    },
    body: JSON.stringify({
      name,
      totalQuantity: 100,
      periodCount: 3,
      startDate: '2026-03-01',
      endDate: '2026-05-01',
    }),
  });
  if (!response.ok)
    throw new Error(`project create failed: ${response.status}`);
  return (await response.json()).data;
}

test('the S curve is the running total of the schedule', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const project = (await createProject((path, init) =>
    admin.fetch(path, init),
  )) as { id: string; schedule: number[] };
  const view = await admin.fetch(`/resourceProjects/${project.id}`);
  expect(view.status).toBe(200);
  const data = (await view.json()).data as {
    schedule: number[];
    cumulative: number[];
  };
  expect(data.cumulative).toHaveLength(data.schedule.length);
  let running = 0;
  for (let index = 0; index < data.schedule.length; index += 1) {
    running += data.schedule[index];
    expect(data.cumulative[index]).toBe(running);
  }
});

test('compares at least two projects side by side', async ({ testApp }) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const first = await createProject((path, init) => admin.fetch(path, init));
  const second = await createSmallProject(
    (path, init) => admin.fetch(path, init),
    'Slab formwork',
  );
  const response = await admin.fetch(
    `/resourceProjects/compare?ids=${(first as { id: string }).id},${(second as { id: string }).id}`,
  );
  expect(response.status).toBe(200);
  const data = (await response.json()).data as {
    projects: { name: string; schedule: number[]; cumulative: number[] }[];
  };
  expect(data.projects).toHaveLength(2);
  expect(data.projects[0].name).toBe('Bridge deck pour');
  expect(data.projects[1].name).toBe('Slab formwork');
  // The S curve of each project is the running total of its schedule.
  for (const project of data.projects) {
    let running = 0;
    for (let index = 0; index < project.schedule.length; index += 1) {
      running += project.schedule[index];
      expect(project.cumulative[index]).toBe(running);
    }
  }
});

test('persists a manual labor override and applies it to the demand', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const project = await createProject((path, init) => admin.fetch(path, init));
  const trade = await createTrade(
    (path, init) => admin.fetch(path, init),
    'Rebar',
    0.2,
  );
  const override = await admin.fetch(
    `/resourceProjects/${(project as { id: string }).id}/overrideLabor`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost',
      },
      body: JSON.stringify({
        trade: trade.name,
        index: 1,
        value: 99,
      }),
    },
  );
  expect(override.status).toBe(200);
  const view = await admin.fetch(
    `/resourceProjects/${(project as { id: string }).id}`,
  );
  expect(view.status).toBe(200);
  const data = (await view.json()).data as {
    labor: { trade: string; periods: number[] }[];
  };
  const row = data.labor.find((entry) => entry.trade === trade.name);
  expect(row).toBeDefined();
  expect(row?.periods[1]).toBe(99);
  // The other periods still follow the quota.
  expect(row?.periods[0]).toBe(1000 * 0.2);
});
