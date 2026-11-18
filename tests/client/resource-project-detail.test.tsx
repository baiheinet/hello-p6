// The project detail page's S-curve card: three curve forms behind one
// segmented control, all drawn from the single view the page already loaded.
// ECharts itself needs a canvas, so the test replaces `echarts-for-react`
// with a stub and checks the option each form produces.
import { answerApi, renderWithApp } from '@nocobase/app-testing/client';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import packageMetadata from '../../package.json' with { type: 'json' };
import enUS from '../../client/locales/en-US.js';
import ProjectDetailPage from '../../client/pages/resource-projects/detail.js';

const charts = vi.hoisted(() => ({ options: [] as Record<string, unknown>[] }));

vi.mock('echarts-for-react', () => ({
  default: function ChartStub({ option }: { option: Record<string, unknown> }) {
    charts.options.push(option);
    return <div data-testid='s-curve-chart' />;
  },
}));

const view = {
  id: 'alpha',
  name: 'Alpha bridge',
  totalQuantity: 100,
  periodCount: 4,
  startDate: '2026-01-01',
  endDate: '2026-04-01',
  schedule: [25, 25, 25, 25],
  cumulative: [25, 50, 75, 100],
  // The server's quadratic ramp, clamped below the plan curve: the banana
  // band the detail route sends.
  latestStartCumulative: [3.33, 16.67, 46.67, 100],
  labor: [],
};

function renderDetail(labor: { trade: string; periods: number[] }[] = []) {
  const api = vi.fn(({ method, path }: { method: string; path: string }) => {
    if (method === 'GET' && path === 'resourceProjects/alpha')
      return { data: { ...view, labor } };
    return new Response(null, { status: 404 });
  });
  const rendered = renderWithApp(
    <Routes>
      <Route
        path='/resource-projects/:projectId'
        element={<ProjectDetailPage />}
      />
    </Routes>,
    {
      route: '/resource-projects/alpha',
      namespace: packageMetadata.name,
      namespaces: { [packageMetadata.name]: enUS },
      fetch: answerApi(api),
    },
  );
  return { api, ...rendered };
}

function lastOption(): Record<string, unknown> {
  const option = charts.options.at(-1);
  if (!option) throw new Error('No chart has been rendered yet');
  return option;
}

async function selectForm(label: string) {
  await userEvent.click(screen.getByRole('tab', { name: label }));
  await waitFor(() => {
    expect(screen.getByTestId('s-curve-chart')).toBeInTheDocument();
  });
}

describe('project detail S-curve forms', () => {
  it('opens with the output-and-cumulative combo chart matching the table', async () => {
    await renderDetail();

    await screen.findByText('Alpha bridge');
    const option = lastOption();
    const series = option.series as {
      name: string;
      type: string;
      data: number[];
    }[];
    expect(series).toEqual([
      {
        name: enUS.resourcePlanning.planned,
        type: 'bar',
        data: view.schedule,
      },
      {
        name: enUS.resourcePlanning.cumulative,
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        data: view.cumulative,
      },
    ]);
    // One axis per series: bars on the left, the cumulative line on the right.
    expect(option.yAxis).toHaveLength(2);
  });

  it('switches to a 0–100% cumulative curve without refetching the page', async () => {
    const { api } = await renderDetail();

    await screen.findByText('Alpha bridge');
    await selectForm(enUS.resourcePlanning.sCurveForms.percent);

    const option = lastOption();
    expect(option.yAxis).toMatchObject({ max: 100 });
    const series = option.series as { data: number[] }[];
    expect(series[0].data[series[0].data.length - 1]).toBe(100);
    expect(api).toHaveBeenCalledTimes(1);
  });

  it('draws the banana curve with both bounds inside the total', async () => {
    await renderDetail();

    await screen.findByText('Alpha bridge');
    await selectForm(enUS.resourcePlanning.sCurveForms.banana);

    const option = lastOption();
    const series = option.series as { name: string; data: number[] }[];
    expect(series.map(({ name }) => name)).toEqual([
      enUS.resourcePlanning.earliestStart,
      enUS.resourcePlanning.latestStart,
    ]);
    const [, latest] = series;
    // The late bound never rises above the plan curve and both end at the
    // total quantity.
    for (let index = 0; index < latest.data.length; index += 1) {
      expect(latest.data[index]).toBeLessThanOrEqual(view.cumulative[index]);
    }
    expect(latest.data[latest.data.length - 1]).toBe(view.totalQuantity);
    // The card explains the two bounds and their shared quantity basis.
    expect(
      screen.getByText(enUS.resourcePlanning.bananaNote),
    ).toBeInTheDocument();
  });

  it('adds per-period, per-trade and grand totals to the labor table', async () => {
    await renderDetail([
      { trade: '普工', periods: [12, 12, 12, 12] },
      { trade: '钢筋工', periods: [3, 3, 3, 3] },
    ]);

    await screen.findByText('Alpha bridge');
    const table = screen.getByText('普工').closest('table');
    expect(table).not.toBeNull();
    const grid = Array.from(table?.rows ?? []).map((row) =>
      Array.from(row.cells).map((cell) => cell.textContent?.trim() ?? ''),
    );
    expect(grid[0]).toEqual([
      enUS.resourcePlanning.trade,
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      enUS.resourcePlanning.total,
    ]);
    expect(grid[1]).toEqual(['普工', '12', '12', '12', '12', '48']);
    expect(grid[2]).toEqual(['钢筋工', '3', '3', '3', '3', '12']);
    expect(grid[3]).toEqual([
      enUS.resourcePlanning.total,
      '15',
      '15',
      '15',
      '15',
      '60',
    ]);
    // The grand total is the sum of every visible demand cell.
    const cells = grid.slice(1, 3).flatMap((row) => row.slice(1, 5));
    expect(Number(grid[3][5])).toBe(
      cells.reduce((sum, value) => sum + Number(value), 0),
    );
  });

  it('labels the three forms on the segmented control', async () => {
    await renderDetail();

    await screen.findByText('Alpha bridge');
    const group = screen.getByRole('tablist', {
      name: enUS.resourcePlanning.sCurveForms.label,
    });
    for (const label of [
      enUS.resourcePlanning.sCurveForms.combo,
      enUS.resourcePlanning.sCurveForms.percent,
      enUS.resourcePlanning.sCurveForms.banana,
    ]) {
      expect(
        within(group).getByRole('tab', { name: label }),
      ).toBeInTheDocument();
    }
  });
});
