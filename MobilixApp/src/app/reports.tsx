import React, { useState } from 'react';
import { router } from 'expo-router';
import { useApp } from '../ctx/AppContext';
import { Repo } from '../db/repo';
import { monthBounds, todayStr } from '../lib/dates';
import { useLoad } from '../lib/hooks';
import { C } from '../lib/theme';
import { Card, Chips, Credit, Grid, KV, ListItem, Loading, Muted, Screen, SectionLabel, Tile, T } from '../ui/kit';

type P = 'today' | 'week' | 'month' | 'last';
const range = (p: P): { from: string; to: string } => {
  const today = todayStr();
  if (p === 'today') return { from: today, to: today };
  if (p === 'month') return monthBounds(0);
  if (p === 'last') return monthBounds(-1);
  const d = new Date(); d.setDate(d.getDate() - 6);
  return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, to: today };
};

export default function Reports() {
  const { t, money, viewBranch } = useApp();
  const [p, setP] = useState<P>('month');
  const [r, reload] = useLoad(() => { const x = range(p); return Repo.report(x.from, x.to, viewBranch); }, [p, viewBranch]);
  const [dash] = useLoad(() => Repo.dashboard(viewBranch), [viewBranch]);
  const [parties] = useLoad(() => Repo.listParties(), []);
  const owe = (parties || []).filter((x) => x.balance > 0.004).sort((a, b) => b.balance - a.balance).slice(0, 8);
  const payable = (parties || []).filter((x) => x.balance < -0.004).sort((a, b) => a.balance - b.balance).slice(0, 8);

  return (
    <Screen back title={t('reportsTitle')} onRefresh={reload}>
      <Chips value={p} onChange={setP} items={[['today', t('today')], ['week', t('last7')], ['month', t('thisMonth')], ['last', t('lastMonth')]]} />
      {!r ? <Loading /> : (
        <>
          <Grid>
            <Tile label={t('salesTotal')} value={money(r.salesTotal)} />
            <Tile label={t('profit')} value={money(r.profit)} tone={r.profit > 0 ? 'teal' : r.profit < 0 ? 'red' : undefined} />
            <Tile label={t('expenses')} value={money(r.expenses)} />
            <Tile label={t('netProfit')} value={money(r.net)} tone={r.net > 0 ? 'teal' : r.net < 0 ? 'red' : undefined} />
          </Grid>
          <Card flush style={{ marginTop: 12 }}>
            <KV k={t('salesCount')} v={String(r.salesCount)} />
            <KV k={t('phonesSold')} v={String(r.phonesSold)} />
            <KV k={t('purchases')} v={money(r.purchases)} />
            <KV k={t('moneyIn')} v={money(r.collected)} />
            <KV k={t('moneyOut')} v={money(r.paidOut)} />
          </Card>
          <Muted style={{ marginTop: 4 }}>{t('profitHint')}</Muted>
        </>
      )}

      {dash ? (
        <>
          <SectionLabel>{t('businessPosition')}</SectionLabel>
          <Card flush>
            <KV k={t('cashAndBank')} v={money(dash.balance)} />
            <KV k={t('customersOwe')} v={money(dash.receivable)} />
            <KV k={t('stockValue')} v={money(dash.stockValue)} />
            <KV k={t('youOwe')} v={`-${money(dash.payable)}`} vColor={C.danger} />
            <KV k={t('netWorth')} v={money(dash.balance + dash.receivable + dash.stockValue - dash.payable)} />
          </Card>
        </>
      ) : null}

      {owe.length ? (<><SectionLabel>{t('customersOwe')}</SectionLabel><Card flush>{owe.map((x, i) => <ListItem key={x.id} last={i === owe.length - 1} title={x.name} sub={x.phone || ' '} onPress={() => router.push(`/party/${x.id}`)} trail={<T bold num color={C.danger}>{money(x.balance)}</T>} />)}</Card></>) : null}
      {payable.length ? (<><SectionLabel>{t('youOwe')}</SectionLabel><Card flush>{payable.map((x, i) => <ListItem key={x.id} last={i === payable.length - 1} title={x.name} sub={x.phone || ' '} onPress={() => router.push(`/party/${x.id}`)} trail={<T bold num>{money(-x.balance)}</T>} />)}</Card></>) : null}
      <Credit />
    </Screen>
  );
}
