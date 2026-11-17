import { useCan } from '@nocobase/app-plugin-authorization/client';
import { useLocale, useTranslation } from '@nocobase/i18n/client';
import {
  ArrowRightIcon,
  BarChart3Icon,
  FolderKanbanIcon,
  HardHatIcon,
  HammerIcon,
  ListTreeIcon,
  LockKeyholeIcon,
  PlusIcon,
  Rows3Icon,
  type LucideIcon,
} from 'lucide-react';
import { type ReactElement } from 'react';
import { Link } from 'react-router';

import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { RecordLink } from '#components/record-link';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#components/ui/empty';
import { Skeleton } from '#components/ui/skeleton';

import type { ResourceProject } from '../resource-projects/types.js';
import { projectOverview, todayIso, type ProjectOverview } from './overview.js';
import { useProjectOverview } from './use-project-overview.js';

/**
 * This page is the business workbench, not the template's starting page.
 *
 * It used to explain how to develop the application by asking a coding agent
 * and to list the platform's built-in capabilities from the Foundation
 * plugin's capability guide. That content told a signed-in user nothing about
 * construction resource planning, so it was removed here and replaced with
 * the project figures and the business entries this application actually
 * offers. The capability guide remains a registered Foundation route; only
 * its home-page presentation was removed. The application's own copy lives in
 * `client/locales`, which overrides the template's `home` namespace, so a
 * template upgrade can still replace its copy without touching this page.
 */

/** The grants the cards below check; the routes enforce the same resources server-side. */
const PROJECTS_ACCESS = {
  resource: { type: 'page', id: 'resourceProjects' },
  action: 'access',
} as const;
const TRADE_QUOTAS_READ = {
  resource: { type: 'settings', id: 'resourcePlanning.tradeQuotas' },
  action: 'read',
} as const;

export default function HomePage(): ReactElement {
  const { t } = useTranslation();
  const projectsAccess = useCan(PROJECTS_ACCESS);
  const quotasAccess = useCan(TRADE_QUOTAS_READ);
  const canViewProjects = projectsAccess.can;
  const canReadQuotas = quotasAccess.can;
  const permissionsPending = projectsAccess.isPending || quotasAccess.isPending;

  const projects = useProjectOverview(canViewProjects);

  return (
    <PageContainer className='mx-auto max-w-6xl'>
      <PageHeader
        eyebrow={
          <>
            <HammerIcon className='size-4' aria-hidden />
            {t('home.eyebrow')}
          </>
        }
        title={t('home.title')}
        description={t('home.description')}
      />
      {permissionsPending ? (
        <WorkbenchSkeleton />
      ) : canViewProjects || canReadQuotas ? (
        <>
          {canViewProjects ? (
            <OverviewSection
              loading={projects.loading}
              error={projects.error}
              projects={projects.projects}
            />
          ) : null}
          <QuickActions
            canViewProjects={canViewProjects}
            canReadQuotas={canReadQuotas}
          />
        </>
      ) : (
        <RestrictedNotice />
      )}
    </PageContainer>
  );
}

function OverviewSection({
  loading,
  error,
  projects,
}: {
  readonly loading: boolean;
  readonly error: unknown;
  readonly projects?: readonly ResourceProject[];
}): ReactElement {
  const { t } = useTranslation();
  const { locale: language } = useLocale();
  // The same list the projects page loads, counted the same way, so the
  // figures here and there can never disagree.
  const overview: ProjectOverview | undefined = projects
    ? projectOverview(projects, todayIso())
    : undefined;
  // A denied or failed read leaves the figures unknown: the stat cards say so
  // instead of staying on their loading skeleton for ever.
  const unavailable = !loading && !overview;

  return (
    <section
      aria-labelledby='home-overview'
      aria-busy={loading}
      className='flex flex-col gap-3'
    >
      <div className='flex flex-col gap-1'>
        <h2 id='home-overview' className='text-base font-medium'>
          {t('home.overview.title')}
        </h2>
        <p className='text-sm text-muted-foreground'>
          {t('home.overview.description')}
        </p>
      </div>
      <div className='grid gap-3 sm:grid-cols-2'>
        <StatCard
          icon={FolderKanbanIcon}
          label={t('home.overview.totalProjects')}
          loading={loading}
          unavailable={unavailable}
          value={overview?.total}
        />
        <StatCard
          icon={HardHatIcon}
          hint={t('home.overview.inProgressHint')}
          label={t('home.overview.inProgress')}
          loading={loading}
          unavailable={unavailable}
          value={overview?.inProgress}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('home.overview.recent')}</CardTitle>
          <CardAction>
            <Link
              to='/resource-projects'
              className='inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline'
            >
              {t('home.overview.viewAll')}
              <ArrowRightIcon className='size-4' aria-hidden />
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='flex flex-col gap-3'>
              <Skeleton className='h-4 w-2/3' />
              <Skeleton className='h-4 w-1/2' />
              <Skeleton className='h-4 w-3/5' />
            </div>
          ) : error || !overview ? (
            <p className='text-sm text-muted-foreground'>
              {t('home.overview.unavailable')}
            </p>
          ) : overview.recent.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              {t('home.overview.noProjects')}
            </p>
          ) : (
            <ul className='divide-y divide-border'>
              {overview.recent.map((project) => (
                <li
                  key={project.id}
                  className='flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0'
                >
                  <div className='flex min-w-0 flex-col gap-0.5'>
                    <RecordLink
                      to={`/resource-projects/${project.id}`}
                      className='truncate'
                    >
                      {project.name}
                    </RecordLink>
                    <span className='text-xs text-muted-foreground'>
                      {t('home.overview.schedule', {
                        start: project.startDate,
                        end: project.endDate,
                      })}
                    </span>
                  </div>
                  {project.updatedAt ? (
                    <span className='text-xs text-muted-foreground whitespace-nowrap'>
                      {t('home.overview.updatedAt', {
                        date: formatDate(project.updatedAt, language),
                      })}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  loading,
  unavailable,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value?: number;
  readonly hint?: string;
  readonly loading: boolean;
  readonly unavailable?: boolean;
}): ReactElement {
  const { t } = useTranslation();
  const { locale: language } = useLocale();
  return (
    <Card size='sm'>
      <CardHeader className='gap-1'>
        <CardDescription className='flex items-center gap-2'>
          <Icon className='size-4' aria-hidden />
          {label}
        </CardDescription>
        <CardTitle className='text-3xl font-semibold tracking-tight'>
          {loading ? (
            <Skeleton className='h-8 w-14' aria-hidden />
          ) : unavailable || value === undefined ? (
            <span className='text-muted-foreground'>
              <span aria-hidden>—</span>
              <span className='sr-only'>
                {t('home.overview.unavailableValue')}
              </span>
            </span>
          ) : (
            new Intl.NumberFormat(language).format(value)
          )}
        </CardTitle>
        {hint ? <p className='text-xs text-muted-foreground'>{hint}</p> : null}
      </CardHeader>
    </Card>
  );
}

function QuickActions({
  canViewProjects,
  canReadQuotas,
}: {
  readonly canViewProjects: boolean;
  readonly canReadQuotas: boolean;
}): ReactElement {
  const { t } = useTranslation();
  return (
    <section aria-labelledby='home-actions' className='flex flex-col gap-3'>
      <div className='flex flex-col gap-1'>
        <h2 id='home-actions' className='text-base font-medium'>
          {t('home.actions.title')}
        </h2>
        <p className='text-sm text-muted-foreground'>
          {t('home.actions.description')}
        </p>
      </div>
      <ul className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        {canViewProjects ? (
          <>
            <QuickAction
              to='/resource-projects/new'
              icon={PlusIcon}
              title={t('home.actions.newProject')}
              description={t('home.actions.newProjectDescription')}
            />
            <QuickAction
              to='/resource-projects'
              icon={ListTreeIcon}
              title={t('home.actions.projects')}
              description={t('home.actions.projectsDescription')}
            />
            <QuickAction
              to='/resource-projects/compare'
              icon={Rows3Icon}
              title={t('resourcePlanning.compare')}
              description={t('resourcePlanning.compareDescription')}
            />
          </>
        ) : null}
        {canReadQuotas ? (
          <QuickAction
            to='/resource-planning/trades'
            icon={BarChart3Icon}
            title={t('resourcePlanning.tradeQuotas')}
            description={t('resourcePlanning.tradeQuotasDescription')}
          />
        ) : null}
      </ul>
    </section>
  );
}

function QuickAction({
  to,
  icon: Icon,
  title,
  description,
}: {
  readonly to: string;
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
}): ReactElement {
  return (
    <li className='flex'>
      <Link
        to={to}
        className='group flex w-full cursor-pointer rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
      >
        <Card className='w-full transition-[translate,box-shadow,background-color] duration-200 ease-out group-hover:-translate-y-0.5 group-hover:bg-hover group-hover:shadow-md motion-reduce:transition-none motion-reduce:group-hover:translate-y-0'>
          <CardHeader className='gap-3'>
            <span className='flex size-9 items-center justify-center rounded-lg bg-primary/5 text-primary ring-1 ring-transparent transition-[background-color,box-shadow] duration-200 ease-out group-hover:bg-primary/10 group-hover:ring-border motion-reduce:transition-none'>
              <Icon
                className='size-4 transition-transform duration-200 ease-out group-hover:scale-110 motion-reduce:transition-none'
                aria-hidden
              />
            </span>
            <div className='flex flex-col gap-1'>
              <CardTitle>{title}</CardTitle>
              <CardDescription className='leading-6'>
                {description}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </Link>
    </li>
  );
}

function RestrictedNotice(): ReactElement {
  const { t } = useTranslation();
  return (
    <Empty className='border'>
      <EmptyHeader>
        <EmptyMedia variant='icon'>
          <LockKeyholeIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{t('home.restricted.title')}</EmptyTitle>
        <EmptyDescription>{t('home.restricted.description')}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function WorkbenchSkeleton(): ReactElement {
  return (
    <div aria-busy='true' className='flex flex-col gap-3'>
      <Skeleton className='h-5 w-40' />
      <div className='grid gap-3 sm:grid-cols-2'>
        <Skeleton className='h-24 w-full rounded-xl' />
        <Skeleton className='h-24 w-full rounded-xl' />
      </div>
      <Skeleton className='h-40 w-full rounded-xl' />
    </div>
  );
}

function formatDate(value: string, language: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(language, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
}
