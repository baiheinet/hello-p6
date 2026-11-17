import { useTranslation } from '@nocobase/i18n/client';
import { type ReactElement, useState } from 'react';

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
import { Input } from '#components/ui/input';
import { PlusIcon } from 'lucide-react';

import { useSaveTradeQuota, useTrades } from '../resource-projects/api.js';

export default function TradeQuotasPage(): ReactElement {
  const { t } = useTranslation();
  const { data: trades, error, loading } = useTrades();
  const save = useSaveTradeQuota();
  const [newName, setNewName] = useState('');
  const [newQuota, setNewQuota] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAdd = () => {
    if (!newName.trim() || Number(newQuota) < 0) return;
    setBusy(true);
    void save({
      name: newName.trim(),
      unitQuota: Number(newQuota),
    })
      .then(() => {
        setNewName('');
        setNewQuota('');
      })
      .finally(() => setBusy(false));
  };

  const handleSaveRow = (row: { name: string; unitQuota: number }) => {
    setBusy(true);
    void save(row).finally(() => setBusy(false));
  };

  if (error)
    return (
      <PageContainer>
        <PageHeader title={t('resourcePlanning.tradeQuotas')} />
        <p className='text-sm text-destructive'>
          {t('resourcePlanning.error.load')}
        </p>
      </PageContainer>
    );
  if (loading)
    return (
      <PageContainer>
        <PageHeader title={t('resourcePlanning.tradeQuotas')} />
        <p className='text-sm text-muted-foreground'>
          {t('resourcePlanning.loading')}
        </p>
      </PageContainer>
    );

  return (
    <PageContainer>
      <PageHeader
        title={t('resourcePlanning.tradeQuotas')}
        description={t('resourcePlanning.tradeQuotasDescription')}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t('resourcePlanning.tradeQuotas')}</CardTitle>
        </CardHeader>
        <CardContent>
          {trades?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('resourcePlanning.trade')}</TableHead>
                  <TableHead>{t('resourcePlanning.quota')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((trade) => (
                  <QuotaRow
                    key={trade.id}
                    initial={{ name: trade.name, unitQuota: trade.unitQuota }}
                    busy={busy}
                    onSave={handleSaveRow}
                  />
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className='text-sm text-muted-foreground'>
              {t('resourcePlanning.noTrades')}
            </p>
          )}
          <div className='mt-4 flex flex-wrap items-end gap-3'>
            <label className='flex flex-col gap-1 text-sm'>
              {t('resourcePlanning.form.newTrade')}
              <Input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
              />
            </label>
            <label className='flex flex-col gap-1 text-sm'>
              {t('resourcePlanning.quota')}
              <Input
                value={newQuota}
                inputMode='decimal'
                onChange={(event) => setNewQuota(event.target.value)}
              />
            </label>
            <Button
              disabled={busy || !newName.trim() || Number(newQuota) < 0}
              onClick={handleAdd}
            >
              <PlusIcon data-icon='inline-start' />
              {t('resourcePlanning.addTrade')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function QuotaRow({
  initial,
  busy,
  onSave,
}: {
  readonly initial: { name: string; unitQuota: number };
  readonly busy: boolean;
  readonly onSave: (row: { name: string; unitQuota: number }) => void;
}): ReactElement {
  const { t } = useTranslation();
  const [name, setName] = useState(initial.name);
  const [quota, setQuota] = useState(String(initial.unitQuota));
  const dirty = name !== initial.name || quota !== String(initial.unitQuota);
  return (
    <TableRow>
      <TableCell>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label={t('resourcePlanning.trade')}
        />
      </TableCell>
      <TableCell>
        <Input
          value={quota}
          inputMode='decimal'
          onChange={(event) => setQuota(event.target.value)}
          aria-label={t('resourcePlanning.quota')}
        />
      </TableCell>
      <TableCell>
        <Button
          variant='ghost'
          size='sm'
          disabled={!dirty || busy}
          onClick={() => {
            onSave({ name: name.trim(), unitQuota: Number(quota) });
          }}
        >
          {t('resourcePlanning.save')}
        </Button>
      </TableCell>
    </TableRow>
  );
}
