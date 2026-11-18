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
  )) as {
    id: string;
    schedule: number[];
    createdAt?: string;
    updatedAt?: string;
  };
  // 10000 / 10 = 1000 each, matching the issue's acceptance example.
  expect(project.schedule).toHaveLength(10);
  expect(project.schedule.reduce((sum, value) => sum + value, 0)).toBe(10000);
  expect(project.schedule[0]).toBe(1000);
  // The workbench orders projects by their last write, so a create dates its row.
  expect(project.createdAt).toBeTruthy();
  expect(project.updatedAt).toBeTruthy();

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
  const next = (await adjusted.json()).data as {
    schedule: number[];
    updatedAt?: string;
  };
  expect(next.schedule[3]).toBe(2500);
  // The remaining 7500 spread over the other nine periods: 833, 833, 834,
  // 834, 834, 834, 834, 834, 834, so the total stays 10000.
  expect(next.schedule.reduce((sum, value) => sum + value, 0)).toBe(10000);
  expect(Date.parse(next.updatedAt ?? '')).toBeGreaterThanOrEqual(
    Date.parse(project.updatedAt ?? ''),
  );
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

test('the detail view adds the latest-start bound for the banana curve', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const project = (await createProject((path, init) =>
    admin.fetch(path, init),
  )) as { id: string; schedule: number[] };
  const response = await admin.fetch(`/resourceProjects/${project.id}`);
  expect(response.status).toBe(200);
  const data = (await response.json()).data as {
    schedule: number[];
    cumulative: number[];
    latestStartCumulative: number[];
  };
  expect(data.latestStartCumulative).toHaveLength(data.schedule.length);
  // Both bounds end at the total, the late one rises monotonically, and it
  // never rises above the plan's own cumulative curve.
  expect(
    data.latestStartCumulative[data.latestStartCumulative.length - 1],
  ).toBe(10000);
  for (let index = 0; index < data.latestStartCumulative.length; index += 1) {
    expect(data.latestStartCumulative[index]).toBeLessThanOrEqual(
      data.cumulative[index],
    );
    if (index > 0) {
      expect(data.latestStartCumulative[index]).toBeGreaterThanOrEqual(
        data.latestStartCumulative[index - 1],
      );
    }
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

const writeHeaders = {
  'content-type': 'application/json',
  origin: 'http://localhost',
};

async function tradeRows(
  fetch: (input: string, init?: RequestInit) => Promise<Response>,
): Promise<{ id: string; name: string; unitQuota: number }[]> {
  const response = await fetch('/laborTrades');
  expect(response.status).toBe(200);
  return ((await response.json()).data ?? []) as {
    id: string;
    name: string;
    unitQuota: number;
  }[];
}

test('loadDefault requires a signed-in caller with the update grant', async ({
  request,
  testApp,
}) => {
  const anonymous = await request('/laborTrades/loadDefault', {
    method: 'POST',
    headers: writeHeaders,
  });
  expect(anonymous.status).toBe(401);

  // A separate identity: the file's application and database are shared, and
  // the member created by the earlier permission test already exists.
  const loadMember = {
    email: 'load-default-member@example.test',
    password: 'test-load-member-password',
  };
  const userAdmin = testApp.application.container.resolve(
    userAdministrationServiceToken,
  );
  await userAdmin.create({
    name: 'Load-default member',
    email: loadMember.email,
    password: loadMember.password,
  });
  const memberSession = await signIn(testApp, loadMember);
  const forbidden = await memberSession.fetch('/laborTrades/loadDefault', {
    method: 'POST',
    headers: writeHeaders,
  });
  expect(forbidden.status).toBe(403);
});

test('loadDefault fills missing trades once and never overwrites edits', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const fetch = (path: string, init?: RequestInit) => admin.fetch(path, init);

  // Start from an empty table so the load counts are unambiguous.
  for (const row of await tradeRows(fetch)) {
    const removed = await fetch(`/laborTrades/${row.id}`, {
      method: 'DELETE',
      headers: writeHeaders,
    });
    expect(removed.status).toBe(204);
  }
  expect(await tradeRows(fetch)).toHaveLength(0);

  const first = await fetch('/laborTrades/loadDefault', {
    method: 'POST',
    headers: writeHeaders,
  });
  expect(first.status).toBe(200);
  expect((await first.json()).data).toMatchObject({
    added: 14,
    skipped: 0,
    total: 14,
  });
  const loaded = await tradeRows(fetch);
  expect(loaded).toHaveLength(14);
  expect(loaded.map((row) => row.name)).toEqual(
    expect.arrayContaining(['普工', '钢筋工', '测量工']),
  );

  const second = await fetch('/laborTrades/loadDefault', {
    method: 'POST',
    headers: writeHeaders,
  });
  expect(second.status).toBe(200);
  expect((await second.json()).data).toMatchObject({
    added: 0,
    skipped: 14,
    total: 14,
  });

  // A manually tuned quota survives, while a deleted default trade is filled
  // back in on the next load.
  const edited = loaded.find((row) => row.name === '普工');
  const deleted = loaded.find((row) => row.name === '钢筋工');
  expect(edited).toBeDefined();
  expect(deleted).toBeDefined();
  const tuned = await fetch(`/laborTrades/${edited?.id}`, {
    method: 'PATCH',
    headers: writeHeaders,
    body: JSON.stringify({ unitQuota: 0.77 }),
  });
  expect(tuned.status).toBe(200);
  const removed = await fetch(`/laborTrades/${deleted?.id}`, {
    method: 'DELETE',
    headers: writeHeaders,
  });
  expect(removed.status).toBe(204);

  const third = await fetch('/laborTrades/loadDefault', {
    method: 'POST',
    headers: writeHeaders,
  });
  expect(third.status).toBe(200);
  expect((await third.json()).data).toMatchObject({ added: 1, skipped: 13 });
  const after = await tradeRows(fetch);
  expect(after).toHaveLength(14);
  expect(after.find((row) => row.name === '普工')?.unitQuota).toBe(0.77);
  expect(after.find((row) => row.name === '钢筋工')?.unitQuota).toBe(0.09);
});

test('editing a trade quota recomputes the project labor demand', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const project = await createProject((path, init) => admin.fetch(path, init));
  const viewUrl = `/resourceProjects/${(project as { id: string }).id}`;
  const before = await admin.fetch(viewUrl);
  const beforeData = (await before.json()).data as {
    labor: { trade: string; periods: number[] }[];
  };
  const trade = (await tradeRows((path, init) => admin.fetch(path, init))).find(
    (row) => row.name === '普工',
  );
  expect(trade).toBeDefined();
  // An earlier test may have tuned this row; assert against its current value.
  const general = beforeData.labor.find((row) => row.trade === trade?.name);
  expect(general?.periods[0]).toBe(1000 * (trade?.unitQuota ?? 0));

  const patched = await admin.fetch(`/laborTrades/${trade?.id}`, {
    method: 'PATCH',
    headers: writeHeaders,
    body: JSON.stringify({ unitQuota: 0.5 }),
  });
  expect(patched.status).toBe(200);

  const after = await admin.fetch(viewUrl);
  const afterData = (await after.json()).data as {
    labor: { trade: string; periods: number[] }[];
  };
  expect(afterData.labor.find((row) => row.trade === '普工')?.periods[0]).toBe(
    500,
  );
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
