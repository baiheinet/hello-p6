import { defineMigration, type MigrationDefinition } from '@nocobase/db';

const migration: MigrationDefinition = defineMigration({
  name: '202611170002_create_labor_trades',
  async up({ builder }) {
    await builder.createCollection('laborTrades', (collection) => {
      collection.string('id', { length: 64 }).notNull().primary();
      collection.string('name', { length: 100 }).notNull().unique();
      // Workforce per unit of quantity (people); one global shared table.
      collection.float('unitQuota', { defaultValue: 0 }).notNull();
      collection.datetime('createdAt').nullable();
      collection.datetime('updatedAt').nullable();
    });
  },
  async down({ builder }) {
    await builder.dropCollection('laborTrades');
  },
});
export default migration;
