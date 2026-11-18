import { defineSeed } from '@nocobase/db';

import {
  applyLaborTradeTemplate,
  type LaborTradeTemplateRecord,
} from '../../../server/providers/labor-trade-template.ts';

/**
 * Makes the industry reference quotas available on a fresh install, and fills
 * any missing trades on an upgraded installation. Existing rows are never
 * touched: the same fill-by-name rule backs the page's one-click loader.
 */
export default defineSeed({
  name: '202611180001_labor_trade_template',
  async run(context) {
    await applyLaborTradeTemplate(
      context.repository<LaborTradeTemplateRecord>('laborTrades'),
      (index) => `default-${String(index + 1).padStart(2, '0')}`,
    );
  },
});
