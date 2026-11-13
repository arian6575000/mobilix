import React from 'react';
import { router } from 'expo-router';
import { useApp } from '../ctx/AppContext';
import { Repo } from '../db/repo';
import { Fmt } from '../lib/format';
import { useLoad } from '../lib/hooks';
import { C } from '../lib/theme';
import { Avatar, Badge, Card, Empty, IconButton, ListItem, Loading, Screen, T } from '../ui/kit';
import { View } from 'react-native';

export default function Purchases() {
  const { t, money, viewBranch, lang } = useApp();
  const [list, reload] = useLoad(() => Repo.listPurchases({ branchId: viewBranch }), [viewBranch]);
  return (
    <Screen back title={t('purchasesTitle')} onRefresh={reload} right={<IconButton icon="add" color={C.primary} onPress={() => router.push('/purchase/new')} />}>
      {!list ? <Loading /> : !list.length ? <Empty icon="download-outline" title={t('noPurchases')} /> : (
        <Card flush>
          {list.map((p, i) => (
            <ListItem key={p.id} last={i === list.length - 1} left={<Avatar icon="download-outline" />} title={p.partyName || t('noParty')} sub={`#${p.id} · ${Fmt.date(p.date, lang, true)}`}
              onPress={p.partyId ? () => router.push(`/party/${p.partyId}`) : undefined}
              trail={<View style={{ alignItems: 'flex-end', gap: 4 }}><T bold num>{money(p.total)}</T>{p.due > 0.004 ? <Badge tone="red" label={`${t('due')} ${money(p.due)}`} /> : <Badge tone="teal" label={t('paid')} />}</View>} />
          ))}
        </Card>
      )}
    </Screen>
  );
}
