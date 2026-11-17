import { useTranslation } from '@nocobase/i18n/client';
import { type ReactElement, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import ReactECharts from 'echarts-for-react';

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

import { useCompare, useProjects } from './api.js';
import { periodLabel } from './labels.js';
import type { ResourceProjectView } from './types.js';

export default function ComparePage(): ReactElement {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const ids = useMemo(
    () =>
      (searchParams.get('ids') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    [searchParams],
  );
  const { data: allProjects } = useProjects();
  const { data, error, loading } = useCompare(ids);

  const toggle = (id: string) => {
    const next = ids.includes(id)
      ? ids.filter((value) => value !== id)
      : [...ids, id];
    setSearchParams(next.length ? { ids: next.join(',') } : {});
  };

  if (error)
    return (
      <CompareShell>
        <p className='text-sm text-destructive'>
          {t('resourcePlanning.error.load')}
        </p>
      </CompareShell>
    );
  if (loading || !data || data.projects.length === 0)
    return (
      <CompareShell>
        <p className='text-sm text-muted-foreground'>
          {t('resourcePlanning.compareNeedsSelection')}
        </p>
      </CompareShell>
    );

  const first = data.projects[0];
  const periodCount = first.schedule.length;
  const periodLabels = Array.from({ length: periodCount }, (_, index) =>
    periodLabel(index, first.startDate),
  );
  const nameOf = (view: ResourceProjectView) => view.name;
  const sCurveOption = {
    grid: { left: 48, right: 24, top: 32, bottom: 32 },
    xAxis: { type: 'category', data: periodLabels },
    yAxis: { type: 'value' },
    tooltip: { trigger: 'axis' },
    legend: { data: data.projects.map(nameOf) },
    series: data.projects.map((project) => ({
      name: project.name,
      type: 'line' as const,
      smooth: true,
      data: project.cumulative,
    })),
  };
  const outputOption = {
    grid: { left: 48, right: 24, top: 32, bottom: 32 },
    xAxis: { type: 'category', data: periodLabels },
    yAxis: { type: 'value' },
    tooltip: { trigger: 'axis' },
    legend: { data: data.projects.map(nameOf) },
    series: data.projects.map((project) => ({
      name: project.name,
      type: 'bar' as const,
      data: project.schedule,
    })),
  };

  return (
    <CompareShell>
      <div className='flex flex-wrap gap-2'>
        {(allProjects ?? []).map((project) => (
          <Button
            key={project.id}
            variant={ids.includes(project.id) ? 'default' : 'outline'}
            size='sm'
            onClick={() => toggle(project.id)}
          >
            {project.name}
          </Button>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('resourcePlanning.outputComparison')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReactECharts
            style={{ height: 288 }}
            option={outputOption}
            notMerge
            key={`output:${ids.join(',')}`}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('resourcePlanning.sCurve')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReactECharts
            style={{ height: 288 }}
            option={sCurveOption}
            notMerge
            key={`s-curve:${ids.join(',')}`}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('resourcePlanning.tables')}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.projects.map((project) => (
            <ProjectComparison
              key={project.id}
              project={project}
              periodCount={periodCount}
            />
          ))}
        </CardContent>
      </Card>
    </CompareShell>
  );
}

function ProjectComparison({
  project,
  periodCount,
}: {
  readonly project: ResourceProjectView;
  readonly periodCount: number;
}): ReactElement {
  const { t } = useTranslation();
  const labor = project.labor;
  return (
    <div className='flex flex-col gap-2 py-2'>
      <h3 className='text-sm font-medium'>{project.name}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('resourcePlanning.period')}</TableHead>
            <TableHead>{t('resourcePlanning.planned')}</TableHead>
            <TableHead>{t('resourcePlanning.cumulative')}</TableHead>
            {labor.map((row) => (
              <TableHead key={row.trade}>{row.trade}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: periodCount }, (_, index) => (
            <TableRow key={index}>
              <TableCell>{periodLabel(index, project.startDate)}</TableCell>
              <TableCell>{project.schedule[index]}</TableCell>
              <TableCell>{project.cumulative[index]}</TableCell>
              {labor.map((row) => (
                <TableCell key={row.trade}>{row.periods[index]}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CompareShell({
  children,
}: {
  readonly children: ReactElement | ReactElement[];
}): ReactElement {
  const { t } = useTranslation();
  return (
    <div className='flex flex-col gap-4 p-4 sm:p-6 md:p-8'>
      <div className='flex flex-col gap-1'>
        <h1 className='font-heading text-2xl font-semibold'>
          {t('resourcePlanning.compare')}
        </h1>
        <p className='text-sm text-muted-foreground'>
          {t('resourcePlanning.compareDescription')}
        </p>
      </div>
      {children}
    </div>
  );
}
