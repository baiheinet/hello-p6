import path from 'node:path';

import { createDatabaseTest } from '@nocobase/app-testing/server';
import { createMigrator } from '@nocobase/db';
import { expect } from 'vitest';

import { LABOR_TRADE_TEMPLATE } from '../../database/seed-data/labor-trade-template.ts';
import seed from '../../database/main/seeds/202611180001_labor_trade_template.ts';

const sources = [
  {
    packageName: 'labor-trade-template-test',
    directory: path.resolve(
      import.meta.dirname,
      '../../database/main/migrations',
    ),
  },
];
const seedSources = [
  {
    packageName: 'labor-trade-template-test',
    directory: path.resolve(import.meta.dirname, '../../database/main/seeds'),
  },
];

const test = createDatabaseTest({ migrations: sources, seeds: seedSources });

test('installs the reference trades on a real database', async ({
  database,
  expectCollection,
}) => {
  await expectCollection('laborTrades').toExist();
  const rows = await database.repository('laborTrades').findMany();
  expect(rows).toHaveLength(LABOR_TRADE_TEMPLATE.length);
  for (const item of LABOR_TRADE_TEMPLATE) {
    const row = rows.find((entry) => entry.name === item.name);
    expect(row, `the template row "${item.name}"`).toBeDefined();
    expect(row?.unitQuota).toBe(item.unitQuota);
  }
});

test('a second seed run adds nothing and keeps an edited quota', async ({
  database,
}) => {
  const repo = database.repository('laborTrades');
  const general = await repo.findOne({ filter: { name: '普工' } });
  expect(general).toBeDefined();
  await repo.updateOne({
    filter: { id: general?.id },
    values: { unitQuota: 0.99 },
  });
  const before = await repo.findMany();

  // The seed only needs a repository factory; call its run again the way the
  // seeder does on a database that already has its history recorded.
  await seed.run({
    repository: (name: string) => database.repository(name),
  } as never);

  const after = await repo.findMany();
  expect(after).toHaveLength(before.length);
  expect((await repo.findOne({ filter: { name: '普工' } }))?.unitQuota).toBe(
    0.99,
  );
});

test('the existing migration down drops the seeded table', async ({
  database,
  expectCollection,
}) => {
  const migrator = createMigrator({ database, sources });
  const rollback = await migrator.rollback();
  expect(rollback.rolledBack).toContain('202611170002_create_labor_trades');
  await expectCollection('laborTrades').not.toExist();
});
