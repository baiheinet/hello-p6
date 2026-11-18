import { useTranslation } from '@nocobase/i18n/client';
import { type ReactElement, type FocusEvent, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import ReactECharts from 'echarts-for-react';
import { Rows3Icon } from 'lucide-react';

import { laborTotals } from './labor-totals.js';

import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '#components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '#components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '#components/ui/tabs';
import { Button } from '#components/ui/button';

import { periodLabel } from './labels.js';
import { useCompareEntryVisible } from './use-compare-entry.js';
import { useAdjustPeriod, useOverrideLabor, useProjectView } from './api.js';
import type { ResourceProjectView } from './types.js';

/** The S-curve forms the card can switch between, in segmented-control order. */
type CurveForm = 'combo' | 'percent' | 'banana';

/** The two plans a banana curve compares; both drive the labor table. */
type CurveScenario = 'earliest' | 'latest';

export default function ProjectDetailPage(): ReactElement {
  const { projectId } = useParams();
  const { t } = useTranslation();
  // The view choices live for this session only: switching never refetches
  // the project, it just re-reads the already-loaded S curve and labor data.
  const [form, setForm] = useState<CurveForm>('combo');
  const [scenario, setScenario] = useState<CurveScenario>('earliest');
  const {
    data: view,
    error,
    loading,
    reload,
  } = useProjectView(projectId ?? '');

  if (error)
    return (
      <Shell>
        <p className='text-sm text-destructive'>
          {t('resourcePlanning.error.load')}
        </p>
      </Shell>
    );
  if (loading || !view)
    return (
      <Shell>
        <p className='text-sm text-muted-foreground'>
          {t('resourcePlanning.loading')}
        </p>
      </Shell>
    );

  return (
    <Shell view={view}>
      <ScheduleSection view={view} onSaved={reload} />
      <SCurveCard
        view={view}
        form={form}
        onFormChange={setForm}
        scenario={scenario}
        onScenarioChange={setScenario}
      />
      <LaborSection
        view={view}
        form={form}
        scenario={scenario}
        onSaved={reload}
      />
    </Shell>
  );
}

function Shell({
  view,
  children,
}: {
  readonly view?: ResourceProjectView;
  readonly children: ReactElement | ReactElement[];
}): ReactElement {
  const { t } = useTranslation();
  const canOpenCompare = useCompareEntryVisible();
  return (
    <PageContainer>
      <PageHeader
        title={view?.name ?? t('resourcePlanning.project')}
        description={
          view
            ? t('resourcePlanning.projectDescription', {
                total: view.totalQuantity,
                periods: view.periodCount,
              })
            : undefined
        }
        actions={
          canOpenCompare ? (
            <Button
              variant='outline'
              nativeButton={false}
              render={<Link to='../compare' />}
            >
              <Rows3Icon data-icon='inline-start' />
              {t('resourcePlanning.compareEntry')}
            </Button>
          ) : undefined
        }
      />
      {children}
    </PageContainer>
  );
}

function SCurveCard({
  view,
  form,
  onFormChange,
  scenario,
  onScenarioChange,
}: {
  readonly view: ResourceProjectView;
  readonly form: CurveForm;
  readonly onFormChange: (form: CurveForm) => void;
  readonly scenario: CurveScenario;
  readonly onScenarioChange: (scenario: CurveScenario) => void;
}): ReactElement {
  const { t } = useTranslation();
  const labels = useMemo(
    () => view.schedule.map((_, index) => periodLabel(index, view.startDate)),
    [view],
  );
  const option = useMemo(() => {
    if (form === 'combo') {
      // P6 Usage-Profile style: one bar per period on the left axis, the
      // cumulative curve on the right axis. Both read the same values as
      // the schedule table.
      return {
        grid: { left: 48, right: 48, top: 32, bottom: 32 },
        legend: { top: 0 },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: labels },
        yAxis: [
          { type: 'value' },
          { type: 'value', splitLine: { show: false } },
        ],
        series: [
          {
            name: t('resourcePlanning.planned'),
            type: 'bar',
            data: view.schedule,
          },
          {
            name: t('resourcePlanning.cumulative'),
            type: 'line',
            smooth: true,
            yAxisIndex: 1,
            data: view.cumulative,
          },
        ],
      };
    }
    if (form === 'percent') {
      // The same cumulative curve on a 0–100% scale: cumulative ÷ total.
      const percent = view.cumulative.map((value) =>
        view.totalQuantity > 0 ? (value / view.totalQuantity) * 100 : 0,
      );
      return {
        grid: { left: 48, right: 24, top: 32, bottom: 32 },
        tooltip: {
          trigger: 'axis',
          valueFormatter: (value: number) => `${value.toFixed(1)}%`,
        },
        xAxis: { type: 'category', data: labels },
        yAxis: {
          type: 'value',
          max: 100,
          axisLabel: { formatter: '{value}%' },
        },
        series: [
          {
            name: t('resourcePlanning.cumulativePercent'),
            type: 'line',
            smooth: true,
            areaStyle: {},
            data: percent,
          },
        ],
      };
    }
    // Banana curve: the earliest-start bound is the project's own
    // cumulative curve; the latest-start bound comes from the server and
    // never rises above it, so the band between them is the plan's float.
    // The selected scenario is drawn solid and the other is dashed, so the
    // curve and the labor table below highlight the same plan.
    const emphasis = (selected: boolean) =>
      selected
        ? { lineStyle: { width: 3 } }
        : { lineStyle: { type: 'dashed', opacity: 0.55 } };
    return {
      grid: { left: 48, right: 24, top: 32, bottom: 32 },
      legend: { top: 0 },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: labels },
      yAxis: { type: 'value' },
      series: [
        {
          name: t('resourcePlanning.earliestStart'),
          type: 'line',
          smooth: true,
          data: view.cumulative,
          ...emphasis(scenario === 'earliest'),
        },
        {
          name: t('resourcePlanning.latestStart'),
          type: 'line',
          smooth: true,
          data: view.latestStartCumulative,
          ...emphasis(scenario === 'latest'),
        },
      ],
    };
  }, [form, labels, scenario, t, view]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('resourcePlanning.sCurve')}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        <Tabs
          value={form}
          onValueChange={(value) => onFormChange(value as CurveForm)}
        >
          <TabsList aria-label={t('resourcePlanning.sCurveForms.label')}>
            <TabsTrigger value='combo'>
              {t('resourcePlanning.sCurveForms.combo')}
            </TabsTrigger>
            <TabsTrigger value='percent'>
              {t('resourcePlanning.sCurveForms.percent')}
            </TabsTrigger>
            <TabsTrigger value='banana'>
              {t('resourcePlanning.sCurveForms.banana')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {form === 'banana' ? (
          <Tabs
            value={scenario}
            onValueChange={(value) => onScenarioChange(value as CurveScenario)}
          >
            <TabsList aria-label={t('resourcePlanning.bananaScenarioLabel')}>
              <TabsTrigger value='earliest'>
                {t('resourcePlanning.earliestStart')}
              </TabsTrigger>
              <TabsTrigger value='latest'>
                {t('resourcePlanning.latestStart')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        ) : null}
        <ReactECharts style={{ height: 288 }} option={option} notMerge />
        {form === 'banana' ? (
          <p className='text-xs text-muted-foreground'>
            {t('resourcePlanning.bananaNote')}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ScheduleSection({
  view,
  onSaved,
}: {
  readonly view: ResourceProjectView;
  readonly onSaved: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const adjust = useAdjustPeriod();
  const [draft, setDraft] = useState<{ index: number; value: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const handleApply = () => {
    if (!draft) return;
    const value = Number(draft.value);
    if (Number.isNaN(value) || value < 0) return;
    setSaving(true);
    void adjust(view.id, draft.index, value).finally(() => {
      setSaving(false);
      setDraft(null);
      onSaved();
    });
  };

  const rows = view.schedule.map((quantity, index) => ({
    index,
    quantity,
    cumulative: view.cumulative[index],
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('resourcePlanning.schedule')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('resourcePlanning.period')}</TableHead>
              <TableHead>{t('resourcePlanning.planned')}</TableHead>
              <TableHead>{t('resourcePlanning.cumulative')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ index, quantity, cumulative }) => (
              <TableRow key={index}>
                <TableCell>{periodLabel(index, view.startDate)}</TableCell>
                <TableCell>
                  <div className='flex items-center gap-2'>
                    {draft?.index === index ? (
                      <input
                        type='number'
                        min={0}
                        defaultValue={quantity}
                        autoFocus
                        onChange={(event) =>
                          setDraft({ index, value: event.target.value })
                        }
                        className='w-24 rounded border border-input px-2 py-1'
                      />
                    ) : (
                      quantity
                    )}
                    {draft?.index === index ? (
                      <Button
                        variant='ghost'
                        size='sm'
                        disabled={saving}
                        onClick={handleApply}
                      >
                        {t('resourcePlanning.apply')}
                      </Button>
                    ) : (
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() =>
                          setDraft({ index, value: String(quantity) })
                        }
                      >
                        {t('resourcePlanning.adjust')}
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>{cumulative}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function LaborSection({
  view,
  form,
  scenario,
  onSaved,
}: {
  readonly view: ResourceProjectView;
  readonly form: CurveForm;
  readonly scenario: CurveScenario;
  readonly onSaved: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const override = useOverrideLabor();
  const [editing, setEditing] = useState<{
    trade: string;
    index: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  // Only the banana curve's "latest start" scenario changes the per-period
  // quantity. The other forms keep the current schedule, so their labor is
  // the server's earliest-start demand.
  const rows =
    form === 'banana' && scenario === 'latest'
      ? view.laborLatestStart
      : view.labor;
  const totals = useMemo(
    () => laborTotals(rows, view.schedule.length),
    [rows, view.schedule.length],
  );

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (!editing) return;
    const parsed =
      event.target.value === '' ? null : Number(event.target.value);
    setSaving(true);
    void override(view.id, editing.trade, editing.index, parsed).finally(() => {
      setSaving(false);
      setEditing(null);
      onSaved();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('resourcePlanning.labor')}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        <p className='text-xs text-muted-foreground'>
          {form === 'banana'
            ? t('resourcePlanning.laborScenarioNote')
            : t('resourcePlanning.laborUnchangedNote')}
        </p>
        {rows.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            {t('resourcePlanning.noTrades')}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('resourcePlanning.trade')}</TableHead>
                {view.schedule.map((_, index) => (
                  <TableHead key={periodLabel(index, view.startDate)}>
                    {periodLabel(index, view.startDate)}
                  </TableHead>
                ))}
                <TableHead>{t('resourcePlanning.total')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ trade, periods }) => (
                <TableRow key={trade}>
                  <TableCell>{trade}</TableCell>
                  {periods.map((value, index) => {
                    const isEditing =
                      editing?.trade === trade && editing.index === index;
                    const cellKey = `${trade}:${periodLabel(index, view.startDate)}`;
                    return (
                      <TableCell key={cellKey}>
                        {isEditing ? (
                          <input
                            type='number'
                            min={0}
                            defaultValue={value}
                            autoFocus
                            disabled={saving}
                            onBlur={handleBlur}
                            className='w-20 rounded border border-input px-2 py-1'
                          />
                        ) : (
                          <button
                            type='button'
                            className='rounded px-1 text-left hover:bg-accent'
                            onClick={() => setEditing({ trade, index })}
                          >
                            {value}
                          </button>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className='font-medium'>
                    {totals.trade[trade]}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className='font-medium'>
                <TableCell>{t('resourcePlanning.total')}</TableCell>
                {totals.period.map((value, index) => (
                  <TableCell key={periodLabel(index, view.startDate)}>
                    {value}
                  </TableCell>
                ))}
                <TableCell>{totals.grand}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
