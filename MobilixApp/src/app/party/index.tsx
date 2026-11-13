import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import { Fmt } from '../../lib/format';
import { useLoad } from '../../lib/hooks';
import { C } from '../../lib/theme';
import { Avatar, Card, Chips, Empty, IconButton, ListItem, Loading, Muted, Screen, SearchBar, T } from '../../ui/kit';

type K = 'all' | 'customer' | 'supplier' | 'balance';

export default function Parties() {
  const { t, money } = useApp();
  const [k, setK] = useState<K>('all');
  const [q, setQ] = useState('');
  const [list, reload] = useLoad(() => Repo.listParties({ kind: k === 'customer' || k === 'supplier' ? k : undefined, q }), [k, q]);
  const rows = (list || []).filter((p) => k !== 'balance' || Math.abs(p.balance) > 0.004);
  return (
    <Screen back title={t('parties')} onRefresh={reload} right={<IconButton icon="add" color={C.primary} onPress={() => router.push('/party/form')} />}>
      <SearchBar value={q} onChangeText={setQ} placeholder={t('searchParties')} />
      <Chips value={k} onChange={setK} items={[['all', t('all')], ['customer', t('customers')], ['supplier', t('suppliers')], ['balance', t('withBalance')]]} />
      {!list ? <Loading /> : !rows.length ? <Empty icon="people-outline" title={t('noParties')} /> : (
        <Card flush>
          {rows.map((p, i) => (
            <ListItem key={p.id} last={i === rows.length - 1} onPress={() => router.push(`/party/${p.id}`)} left={<Avatar text={Fmt.initials(p.name)} />} title={p.name} sub={p.phone || ' '}
              trail={Math.abs(p.balance) > 0.004 ? <View style={{ alignItems: 'flex-end' }}><T bold size={14} num color={p.balance > 0 ? C.danger : C.success}>{money(Math.abs(p.balance))}</T><Muted>{p.balance > 0 ? t('theyOwe') : t('youOweThem')}</Muted></View> : null} />
          ))}
        </Card>
      )}
    </Screen>
  );
}
