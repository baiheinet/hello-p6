/**
 * Industry reference baseline for the shared labor-trade quota table.
 *
 * These values are a reproducible starting point, not a locked standard: each
 * row stays editable on the trade-quotas page and can be adjusted to a
 * project's region or a company's own consumption norm.
 *
 * This file is frozen reference data. Both the installation seed and the
 * one-click loader import it, so new installs and a manual load always offer
 * the same baseline. Treat edits here as a new template version, not as a
 * change to an already executed seed.
 */
export interface LaborTradeTemplateRow {
  readonly name: string;
  /** Workforce per unit of quantity, in people (工日 / unit quantity). */
  readonly unitQuota: number;
}

export const LABOR_TRADE_TEMPLATE: readonly LaborTradeTemplateRow[] = [
  { name: '普工', unitQuota: 0.12 },
  { name: '木工（模板工）', unitQuota: 0.18 },
  { name: '钢筋工', unitQuota: 0.09 },
  { name: '混凝土工', unitQuota: 0.08 },
  { name: '砌筑工（瓦工）', unitQuota: 0.15 },
  { name: '抹灰工', unitQuota: 0.1 },
  { name: '架子工', unitQuota: 0.05 },
  { name: '电工', unitQuota: 0.04 },
  { name: '水暖/管道工', unitQuota: 0.05 },
  { name: '焊工', unitQuota: 0.03 },
  { name: '防水工', unitQuota: 0.06 },
  { name: '油漆工', unitQuota: 0.07 },
  { name: '起重/塔吊司机', unitQuota: 0.02 },
  { name: '测量工', unitQuota: 0.01 },
] as const;
