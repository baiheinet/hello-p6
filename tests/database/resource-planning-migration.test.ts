import path from 'node:path';
import { describeMigration } from '@nocobase/app-testing/server';
import { expect } from 'vitest';

const sources = [
  {
    packageName: 'resource-planning-test',
    directory: path.resolve(
      import.meta.dirname,
      '../../database/main/migrations',
    ),
  },
];

describeMigration('202611170001_create_resource_projects', {
  sources,
  up: async ({ expectCollection }) => {
    await expectCollection('resourceProjects').toExist();
    await expectCollection('resourceProjects').toHaveField('name', {
      nullable: false,
    });
    await expectCollection('resourceProjects').toHaveField('schedule');
    await expectCollection('resourceProjects').toHaveField('laborOverrides', {
      nullable: true,
    });
  },
  down: async ({ expectCollection }) => {
    await expectCollection('resourceProjects').not.toExist();
  },
});

describeMigration('202611170002_create_labor_trades', {
  sources,
  up: async ({ expectCollection, connection }) => {
    await expectCollection('laborTrades').toExist();
    await expectCollection('laborTrades').toHaveField('unitQuota', {
      nullable: false,
    });
    // The trade name is the key the overrides and the pages use, so it stays
    // unique.
    await connection.query
      .insertInto('laborTrades')
      .values({ id: 'trade-1', name: 'Rebar', unitQuota: 0.2 })
      .execute();
    await expect(
      connection.query
        .insertInto('laborTrades')
        .values({ id: 'trade-2', name: 'Rebar', unitQuota: 0.3 })
        .execute(),
    ).rejects.toThrow();
  },
  down: async ({ expectCollection }) => {
    await expectCollection('laborTrades').not.toExist();
  },
});
