import { defineMigration, type MigrationDefinition } from '@nocobase/db';

const migration: MigrationDefinition = defineMigration({
  name: '202611170001_create_resource_projects',
  async up({ builder }) {
    await builder.createCollection('resourceProjects', (collection) => {
      collection.string('id', { length: 64 }).notNull().primary();
      collection.string('name', { length: 200 }).notNull();
      collection.float('totalQuantity', { defaultValue: 0 }).notNull();
      collection.integer('periodCount', { defaultValue: 1 }).notNull();
      collection.date('startDate').notNull();
      collection.date('endDate').notNull();
      // The planned quantity for each period, as a JSON array in period order.
      // It is edited as one unit (adjusting one period recalculates the rest),
      // so it lives in the row rather than a child table.
      collection.json('schedule', { defaultValue: '[]' }).notNull();
      // Manual per-period labor overrides: a JSON object keyed by trade name,
      // each value a map of period index (as a string) to the overridden
      // headcount; a value of null removes that period's override.
      collection.json('laborOverrides').nullable();
      collection.datetime('createdAt').nullable();
      collection.datetime('updatedAt').nullable();
    });
  },
  async down({ builder }) {
    await builder.dropCollection('resourceProjects');
  },
});
export default migration;
