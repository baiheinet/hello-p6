import { useTranslation } from '@nocobase/i18n/client';
import { type ReactElement, type FocusEvent, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import ReactECharts from 'echarts-for-react';
import { Rows3Icon } from 'lucide-react';

import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '#components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#components/ui/table';
import { Button } from '#components/ui/button';
import { useRouteAccess, useRouteTree } from '../../routing/route-context.js';
import { routeKey } from '../../routing/route-navigation.js';

import { periodLabel } from './labels.js';
import { useAdjustPeriod, useOverrideLabor, useProjectView } from './api.js';
import type { ResourceProjectView } from './types.js';

export default function ProjectDetailPage(): ReactElement {
  const { projectId } = useParams();
  const { t } = useTranslation();
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
      <SCurveCard view={view} />
      <LaborSection view={view} onSaved={reload} />
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

/**
 * The compare entry's own access check: the compare route is registered under the `resourceProjects` page, so
 * it carries the same access as the list and detail pages that host it. A viewer who may not open the module
 * page sees no entry, and no dead link. While the permission check is still running the entry is hidden.
 */
function useCompareEntryVisible(): boolean {
  const { denied, loading } = useRouteAccess();
  const routes = useRouteTree();
  if (loading) return false;
  const compare = routes
    .find((route) => route.name === 'resourceProjects')
    ?.children?.find((child) => child.name === 'resourceProjectCompare');
  if (!compare) return false;
  return !denied.has(routeKey(compare));
}

function SCurveCard({
  view,
}: {
  readonly view: ResourceProjectView;
}): ReactElement {
  const { t } = useTranslation();
  const option = useMemo(
    () => ({
      grid: { left: 48, right: 24, top: 32, bottom: 32 },
      xAxis: {
        type: 'category',
        data: view.schedule.map((_, index) =>
          periodLabel(index, view.startDate),
        ),
      },
      yAxis: { type: 'value' },
      tooltip: { trigger: 'axis' },
      series: [
        {
          name: t('resourcePlanning.cumulative'),
          type: 'line',
          smooth: true,
          areaStyle: {},
          data: view.cumulative,
        },
      ],
    }),
    [view, t],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('resourcePlanning.sCurve')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ReactECharts style={{ height: 288 }} option={option} notMerge />
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
  onSaved,
}: {
  readonly view: ResourceProjectView;
  readonly onSaved: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const override = useOverrideLabor();
  const [editing, setEditing] = useState<{
    trade: string;
    index: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);

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
      <CardContent>
        {view.labor.length === 0 ? (
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.labor.map(({ trade, periods }) => (
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
