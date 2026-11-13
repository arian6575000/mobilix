import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import { Fmt } from '../../lib/format';
import { useLoad } from '../../lib/hooks';
import { openWhatsApp } from '../../lib/whatsapp';
import { C } from '../../lib/theme';
import { Avatar, Badge, Card, Chips, Empty, IconButton, ListItem, Loading, Muted, Row, Screen, SearchBar, T } from '../../ui/kit';

type F = 'all' | 'due' | 'installment' | 'overdue';

export default function Sales() {
  const { t, viewBranch, money, lang, settings, toast } = useApp();
  const [f, setF] = useState<F>('all');
  const [q, setQ] = useState('');
  const [sales, reloadS] = useLoad(() => (f === 'overdue' ? Promise.resolve([]) : Repo.listSales({ branchId: viewBranch, q, filter: f === 'all' ? 'all' : f })), [viewBranch, q, f]);
  const [overdue, reloadO] = useLoad(() => Repo.dueInstallments({ branchId: viewBranch }), [viewBranch, f]);

  return (
    <Screen title={t('salesTitle')} onRefresh={async () => { await reloadS(); await reloadO(); }}
      right={<IconButton icon="add" color={C.primary} onPress={() => router.push('/sale/new')} />}>
      <SearchBar value={q} onChangeText={setQ} placeholder={t('searchSales')} />
      <Chips value={f} onChange={setF} items={[['all', t('all')], ['due', t('withBalance')], ['installment', t('kind_installment')], ['overdue', `${t('overdue')}${overdue && overdue.length ? ` (${overdue.length})` : ''}`]]} />

      {f === 'overdue' ? (
        !overdue ? <Loading /> : !overdue.length ? <Empty icon="checkmark-done-outline" title={t('noOverdue')} /> : (
          <Card flush>
            {overdue.map((r, i) => (
              <ListItem key={r.id} last={i === overdue.length - 1} onPress={() => router.push(`/sale/${r.saleId}`)} left={<Avatar text={Fmt.initials(r.partyName)} />}
                title={r.partyName} sub={`${r.invoiceNo} · #${r.seq} · ${Fmt.date(r.dueDate, lang, true)}`}
                trail={<Row gap={6}><View style={{ alignItems: 'flex-end' }}><T bold size={14} num color={C.danger}>{money(r.remaining)}</T><Badge tone="red" label={`${Math.abs(Fmt.daysFromToday(r.dueDate) ?? 0)} ${t('daysLate')}`} /></View>
                  {r.phone ? <IconButton icon="logo-whatsapp" color={C.success} onPress={() => openWhatsApp(r.phone, `Assalam o Alaikum ${r.partyName}, your installment of ${Fmt.money(r.remaining, settings.currency)} for invoice ${r.invoiceNo} was due on ${Fmt.date(r.dueDate, 'en')}. Please pay at your earliest. ${settings.shopName}`, settings.countryCode).catch((e) => toast(e.message, 'error'))} /> : null}</Row>} />
            ))}
          </Card>
        )
      ) : !sales ? <Loading /> : !sales.length ? (
        <Empty icon="receipt-outline" title={t('noSales')} text={t('noSalesHint')} />
      ) : (
        <Card flush>
          {sales.map((s, i) => (
            <ListItem key={s.id} last={i === sales.length - 1} onPress={() => router.push(`/sale/${s.id}`)} left={<Avatar icon="receipt-outline" />}
              title={s.partyName || t('walkIn')} sub={s.summary || ' '} sub2={`${s.invoiceNo} · ${Fmt.date(s.date, lang, true)}`}
              trail={<View style={{ alignItems: 'flex-end', gap: 4 }}><T bold size={14} num>{money(s.total)}</T>{s.due > 0.004 ? <Badge tone="red" label={`${t('due')} ${money(s.due)}`} /> : <Badge tone="teal" label={t('paid')} />}</View>} />
          ))}
        </Card>
      )}
      <Muted center style={{ marginTop: 6 }}> </Muted>
    </Screen>
  );
}
