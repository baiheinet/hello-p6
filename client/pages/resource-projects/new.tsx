import { useTranslation } from '@nocobase/i18n/client';
import { type FormEvent, type ReactElement, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { FeedbackForm } from '#components/feedback-form';
import { RouteDialog } from '#components/route-dialog';
import { useRouteOverlay } from '#components/use-route-overlay';
import { DatePicker } from '#components/date-picker';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#components/ui/field';
import { Input } from '#components/ui/input';
import { Button } from '#components/ui/button';

import { useCreateProject } from './api.js';
import { formatDateOnly } from '#lib/date-only';

export default function NewProjectPage(): ReactElement {
  const { t } = useTranslation();
  const { close } = useRouteOverlay();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const create = useCreateProject();
  const [name, setName] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [periodCount, setPeriodCount] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  const errors = useMemo(() => {
    const result: Record<string, string> = {};
    if (!name.trim()) result.name = t('resourcePlanning.form.nameRequired');
    if (totalQuantity === '' || Number(totalQuantity) < 0)
      result.totalQuantity = t('resourcePlanning.form.quantityRequired');
    if (periodCount === '' || Number(periodCount) < 1)
      result.periodCount = t('resourcePlanning.form.periodsRequired');
    if (!startDate || !endDate)
      result.startDate = t('resourcePlanning.form.datesRequired');
    else if (endDate < startDate)
      result.endDate = t('resourcePlanning.form.endDateBeforeStart');
    return result;
  }, [name, totalQuantity, periodCount, startDate, endDate, t]);

  const submit = () => {
    if (Object.keys(errors).length) return;
    setSubmitting(true);
    void create({
      name: name.trim(),
      totalQuantity: Number(totalQuantity),
      periodCount: Number(periodCount),
      startDate: formatDateOnly(startDate),
      endDate: formatDateOnly(endDate),
    })
      .then(({ data }) => {
        void close();
        void navigate(`../${data.id}`);
      })
      .catch(() => {})
      .finally(() => setSubmitting(false));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  return (
    <RouteDialog
      title={t('resourcePlanning.newProjectTitle')}
      description={t('resourcePlanning.newProjectDescription')}
      footer={
        <footer className='flex justify-end gap-2'>
          <Button variant='ghost' onClick={() => void close()}>
            {t('resourcePlanning.cancel')}
          </Button>
          <Button
            disabled={submitting || Object.keys(errors).length > 0}
            onClick={handleSubmit}
          >
            {submitting
              ? t('resourcePlanning.saving')
              : t('resourcePlanning.create')}
          </Button>
        </footer>
      }
    >
      <FeedbackForm
        noValidate
        submitting={submitting}
        values={() => ({
          name,
          totalQuantity,
          periodCount,
          startDate: startDate ? formatDateOnly(startDate) : '',
          endDate: endDate ? formatDateOnly(endDate) : '',
        })}
        savedValues={undefined}
        onSubmit={submit}
      >
        <FieldGroup>
          <Field data-invalid={Boolean(errors.name)}>
            <FieldLabel htmlFor='rp-name'>
              {t('resourcePlanning.form.name')}
              <span aria-hidden='true' className='text-destructive'>
                {' '}
                *{' '}
              </span>
            </FieldLabel>
            <Input
              id='rp-name'
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={Boolean(errors.name)}
            />
            <FieldError
              errors={[errors.name ? { message: errors.name } : undefined]}
            />
          </Field>
          <div className='grid grid-cols-2 gap-3'>
            <Field data-invalid={Boolean(errors.totalQuantity)}>
              <FieldLabel htmlFor='rp-total'>
                {t('resourcePlanning.form.totalQuantity')}
                <span aria-hidden='true' className='text-destructive'>
                  {' '}
                  *{' '}
                </span>
              </FieldLabel>
              <Input
                id='rp-total'
                inputMode='decimal'
                value={totalQuantity}
                onChange={(event) => setTotalQuantity(event.target.value)}
                aria-invalid={Boolean(errors.totalQuantity)}
              />
              <FieldError
                errors={[
                  errors.totalQuantity
                    ? { message: errors.totalQuantity }
                    : undefined,
                ]}
              />
            </Field>
            <Field data-invalid={Boolean(errors.periodCount)}>
              <FieldLabel htmlFor='rp-periods'>
                {t('resourcePlanning.form.periodCount')}
                <span aria-hidden='true' className='text-destructive'>
                  {' '}
                  *{' '}
                </span>
              </FieldLabel>
              <Input
                id='rp-periods'
                inputMode='numeric'
                value={periodCount}
                onChange={(event) => setPeriodCount(event.target.value)}
                aria-invalid={Boolean(errors.periodCount)}
              />
              <FieldError
                errors={[
                  errors.periodCount
                    ? { message: errors.periodCount }
                    : undefined,
                ]}
              />
            </Field>
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <Field data-invalid={Boolean(errors.startDate)}>
              <FieldLabel htmlFor='rp-start'>
                {t('resourcePlanning.form.startDate')}
              </FieldLabel>
              <DatePicker
                id='rp-start'
                value={startDate}
                onChange={setStartDate}
              />
              <FieldError
                errors={[
                  errors.startDate ? { message: errors.startDate } : undefined,
                ]}
              />
            </Field>
            <Field data-invalid={Boolean(errors.endDate)}>
              <FieldLabel htmlFor='rp-end'>
                {t('resourcePlanning.form.endDate')}
              </FieldLabel>
              <DatePicker id='rp-end' value={endDate} onChange={setEndDate} />
              <FieldError
                errors={[
                  errors.endDate ? { message: errors.endDate } : undefined,
                ]}
              />
            </Field>
          </div>
        </FieldGroup>
      </FeedbackForm>
    </RouteDialog>
  );
}
