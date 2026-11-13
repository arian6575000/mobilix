import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import { useLoad } from '../../lib/hooks';
import { C } from '../../lib/theme';
import { Button, Card, Credit, Grid, Hero, KV, Loading, Muted, Row, Screen, SectionLabel, T, Tile } from '../../ui/kit';

export default function Home() {
  const { t, settings, money } = useApp();
  const branch = settings.activeBranchId;
  const [d, reload] = useLoad(() => Repo.dashboard(branch), [branch]);
  const [accounts] = useLoad(() => Repo.listAccounts(branch), [branch]);
  const hour = new Date().getHours();
  const greet = hour < 12 ? t('goodMorning') : hour < 17 ? t('goodAfternoon') : t('goodEvening');

  return (
    <Screen title={settings.shopName || 'Mobilix'} subtitle={greet} onRefresh={reload}>
      {!d ? <Loading /> : (
        <>
          <Hero label={t('totalBalance')} value={money(d.balance)} hint={t('totalBalanceHint')} />

          <Grid>
            <Tile label={t('todaySales')} value={money(d.todaySales)} />
            <Tile label={t('todayProfit')} value={money(d.todayProfit)} tone={d.todayProfit > 0 ? 'teal' : undefined} />
            <Tile label={t('customersOwe')} value={money(d.receivable)} />
            <Tile label={t('youOwe')} value={money(d.payable)} />
            <Tile label={t('stockValue')} value={money(d.stockValue)} />
            <Tile label={t('phonesInStock')} value={d.phonesInStock} />
          </Grid>

          {d.overdueCount > 0 || d.lowStock > 0 ? (
            <Card style={{ marginTop: 12 }}>
              {d.overdueCount > 0 ? (
                <Row gap={10} style={{ paddingVertical: 4 }}>
                  <Ionicons name="alert-circle" size={20} color={C.danger} />
                  <T bold size={14} color={C.danger} style={{ flex: 1 }}>{t('overdue')}: {d.overdueCount}</T>
                  <T bold size={14} color={C.danger} num>{money(d.overdueAmount)}</T>
                </Row>
              ) : null}
              {d.lowStock > 0 ? (
                <Row gap={10} style={{ paddingVertical: 4 }}>
                  <Ionicons name="cube-outline" size={20} color={C.warning} />
                  <T bold size={14} color={C.warning} style={{ flex: 1 }}>{t('lowStock')}</T>
                  <T bold size={14} color={C.warning} num>{d.lowStock}</T>
                </Row>
              ) : null}
            </Card>
          ) : null}

          <SectionLabel>{t('quickActions')}</SectionLabel>
          <Row gap={10}>
            <Button block icon="add" label={t('sellPhone')} onPress={() => router.push('/sale/new')} />
            <Button block variant="ghost" icon="download-outline" label={t('buyPhone')} onPress={() => router.push('/purchase/new')} />
          </Row>
          <View style={{ height: 10 }} />
          <Row gap={10}>
            <Button block variant="ghost" icon="cash-outline" label={t('receivePayment')} onPress={() => router.push('/party')} />
            <Button block variant="ghost" icon="remove-circle-outline" label={t('addExpense')} onPress={() => router.push('/money')} />
          </Row>

          {accounts && accounts.length ? (
            <>
              <SectionLabel>{t('accounts')}</SectionLabel>
              <Card flush>
                {accounts.map((a) => <KV key={a.id} k={a.name} v={money(a.balance)} />)}
              </Card>
            </>
          ) : null}
          <Muted center style={{ marginTop: 8 }}> </Muted>
        </>
      )}
      <Credit />
    </Screen>
  );
}
