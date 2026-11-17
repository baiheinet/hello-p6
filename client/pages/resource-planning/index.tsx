import { useTranslation } from '@nocobase/i18n/client';
import { type ReactElement } from 'react';

import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { CardDescription, CardTitle } from '#components/ui/card';
import { Link } from 'react-router';

/** The landing page of the resource-planning module: its four entry points. */
export default function ResourcePlanningLanding(): ReactElement {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <PageHeader
        title={t('resourcePlanning.title')}
        description={t('resourcePlanning.description')}
      />
      <ul className='grid gap-3 sm:grid-cols-2'>
        <Entry
          to='/resource-projects'
          title={t('resourcePlanning.title')}
          body={t('resourcePlanning.projectsEntry')}
        />
        <Entry
          to='/resource-projects/compare'
          title={t('resourcePlanning.compare')}
          body={t('resourcePlanning.compareDescription')}
        />
        <Entry
          to='/resource-planning/trades'
          title={t('resourcePlanning.tradeQuotas')}
          body={t('resourcePlanning.tradeQuotasDescription')}
        />
      </ul>
    </PageContainer>
  );
}

function Entry({
  to,
  title,
  body,
}: {
  readonly to: string;
  readonly title: string;
  readonly body: string;
}): ReactElement {
  return (
    <li>
      <Link
        to={to}
        className='block rounded-lg border p-4 transition-colors hover:bg-accent/40'
      >
        <CardTitle className='text-base'>{title}</CardTitle>
        <CardDescription className='mt-1'>{body}</CardDescription>
      </Link>
    </li>
  );
}
