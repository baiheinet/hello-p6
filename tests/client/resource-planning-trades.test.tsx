// The shared trade-quotas page: its one-click template load sends the request,
// refreshes the table and reports what changed. The API is answered through the
// test fixture while the real page, hooks and toaster stay in place.
import {
  answerApi,
  renderWithApp,
  type ApiCall,
} from '@nocobase/app-testing/client';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import packageMetadata from '../../package.json' with { type: 'json' };
import enUS from '../../client/locales/en-US.js';
import TradeQuotasPage from '../../client/pages/resource-planning/trades.js';
import { LABOR_TRADE_TEMPLATE } from '../../database/seed-data/labor-trade-template.ts';

interface TradeRow {
  readonly id: string;
  readonly name: string;
  readonly unitQuota: number;
}

let trades: TradeRow[];

const api = vi.fn(({ method, path }: ApiCall) => {
  if (method === 'GET' && path === 'laborTrades') return { data: trades };
  if (method === 'POST' && path === 'laborTrades/loadDefault') {
    const missing = LABOR_TRADE_TEMPLATE.filter(
      (row) => !trades.some((trade) => trade.name === row.name),
    );
    trades = [
      ...trades,
      ...missing.map((row, index) => ({
        id: `loaded-${index}`,
        name: row.name,
        unitQuota: row.unitQuota,
      })),
    ];
    return {
      data: {
        added: missing.length,
        skipped: LABOR_TRADE_TEMPLATE.length - missing.length,
        total: LABOR_TRADE_TEMPLATE.length,
      },
    };
  }
  return new Response(null, { status: 404 });
});

async function renderTrades() {
  return renderWithApp(<TradeQuotasPage />, {
    route: '/resource-planning/trades',
    namespace: packageMetadata.name,
    namespaces: { [packageMetadata.name]: enUS },
    fetch: answerApi(api),
  });
}

function tradeNames(): string[] {
  return screen
    .queryAllByRole('textbox', { name: enUS.resourcePlanning.trade })
    .map((input) => (input as HTMLInputElement).value);
}

describe('trade quotas template load', () => {
  beforeEach(() => {
    api.mockClear();
    trades = [];
  });

  it('offers a labelled entry and explains the reference nature', async () => {
    await renderTrades();

    expect(
      await screen.findByRole('button', {
        name: enUS.resourcePlanning.loadDefaultQuotas,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(enUS.resourcePlanning.defaultQuotasHint),
    ).toBeInTheDocument();
  });

  it('loads the defaults, refreshes the table and reports the counts', async () => {
    const view = await renderTrades();
    const button = await screen.findByRole('button', {
      name: enUS.resourcePlanning.loadDefaultQuotas,
    });

    await userEvent.click(button);

    await waitFor(() =>
      expect(tradeNames()).toContain(LABOR_TRADE_TEMPLATE[0].name),
    );
    expect(tradeNames()).toContain('测量工');
    expect(api).toHaveBeenCalledWith({
      method: 'POST',
      path: 'laborTrades/loadDefault',
    });
    expect(view.toasts()).toEqual([
      expect.objectContaining({
        type: 'success',
        title: expect.stringContaining('Loaded 14 trade quotas'),
      }),
    ]);
  });

  it('reports a no-op when every default trade is already present', async () => {
    trades = LABOR_TRADE_TEMPLATE.map((row, index) => ({
      id: `existing-${index}`,
      name: row.name,
      unitQuota: row.unitQuota,
    }));
    const view = await renderTrades();

    await userEvent.click(
      await screen.findByRole('button', {
        name: enUS.resourcePlanning.loadDefaultQuotas,
      }),
    );

    await waitFor(() =>
      expect(view.toasts()).toEqual([
        expect.objectContaining({
          type: 'success',
          title: enUS.resourcePlanning.defaultQuotasNoChanges,
        }),
      ]),
    );
    expect(trades).toHaveLength(LABOR_TRADE_TEMPLATE.length);
  });
});
