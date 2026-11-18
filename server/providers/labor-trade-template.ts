import type { Repository } from '@nocobase/db';

import {
  LABOR_TRADE_TEMPLATE,
  type LaborTradeTemplateRow,
} from '../../database/main/seeds/labor-trade-template-data.ts';

/** The record shape the loader needs from the shared trade collection. */
export interface LaborTradeTemplateRecord {
  readonly id: string;
  readonly name: string;
  readonly unitQuota: number;
}

export interface LaborTradeTemplateResult {
  /** Rows the template added to the table. */
  readonly added: number;
  /** Rows already present by name; their existing quota is left untouched. */
  readonly skipped: number;
  readonly total: number;
}

/**
 * Fills the shared trade table with the industry reference baseline.
 *
 * The trade name is the business key (it is also the key labor overrides use),
 * so a row that already exists under that name is never overwritten — a user
 * may have tuned its quota. Only missing trades are inserted, which makes the
 * operation safe to repeat: the second call adds nothing and skips everything.
 *
 * `idFor` is supplied by the caller: the installation seed uses stable ids,
 * while the HTTP route uses the application's id generator. Keeping ids out of
 * the template data means a trade renamed by a user does not collide with the
 * original row when the template is loaded again.
 */
export async function applyLaborTradeTemplate(
  repository: Repository<LaborTradeTemplateRecord>,
  idFor: (index: number) => string,
  rows: readonly LaborTradeTemplateRow[] = LABOR_TRADE_TEMPLATE,
): Promise<LaborTradeTemplateResult> {
  let added = 0;
  let skipped = 0;
  for (const [index, row] of rows.entries()) {
    if (await repository.exists({ filter: { name: row.name } })) {
      skipped += 1;
      continue;
    }
    try {
      await repository.createOne({
        values: {
          id: idFor(index),
          name: row.name,
          unitQuota: row.unitQuota,
        },
      });
      added += 1;
    } catch (error) {
      // A concurrent load (or a just-created trade) can win the unique-name
      // race. Re-checking the name turns that collision into a skip instead of
      // overwriting the winner or surfacing a database error.
      if (await repository.exists({ filter: { name: row.name } })) {
        skipped += 1;
      } else {
        throw error;
      }
    }
  }
  return { added, skipped, total: rows.length };
}
