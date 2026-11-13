import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import type { Phone, PhoneStatus } from '../../db/types';
import { useLoad } from '../../lib/hooks';
import { C } from '../../lib/theme';
import { accessoryLabel, labelsHtml, phoneLabel, printHtml } from '../../lib/receipt';
import { Avatar, Badge, Card, Chips, Empty, IconButton, ListItem, Loading, Muted, Row, Screen, SearchBar, Segmented, T } from '../../ui/kit';

type Filter = PhoneStatus | 'all';

export default function Stock() {
  const { t, viewBranch, money, settings, toast } = useApp();
  const [tab, setTab] = useState<'phones' | 'acc'>('phones');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Filter>('in_stock');
  const [phones, reloadP] = useLoad(() => Repo.listPhones({ branchId: viewBranch, status, q }), [viewBranch, status, q]);
  const [acc, reloadA] = useLoad(() => Repo.listAccessories({ branchId: viewBranch, q }), [viewBranch, q]);

  const printAll = async () => {
    try {
      const items = tab === 'phones' ? (phones || []).filter((p) => p.status === 'in_stock').map(phoneLabel) : (acc || []).map(accessoryLabel);
      if (!items.length) return;
      await printHtml(await labelsHtml(items, settings, 'a4'), 'a4');
    } catch (e: any) { toast(e.message, 'error'); }
  };
  const value = (phones || []).reduce((s, p) => s + (p.status === 'in_stock' ? p.cost : 0), 0);

  return (
    <Screen title={t('stockTitle')} onRefresh={async () => { await reloadP(); await reloadA(); }}
      right={<Row gap={8}>
        <IconButton icon="qr-code-outline" onPress={printAll} />
        <IconButton icon="add" color={C.primary} onPress={() => router.push(tab === 'phones' ? '/purchase/new' : '/accessory/new')} />
      </Row>}>
      <Segmented value={tab} onChange={setTab} items={[['phones', t('phones')], ['acc', t('accessories')]]} />
      <View style={{ height: 12 }} />
      <SearchBar value={q} onChangeText={setQ} placeholder={tab === 'phones' ? t('searchPhones') : t('searchAccessories')} />

      {tab === 'phones' ? (
        <>
          <Chips value={status} onChange={setStatus} items={[['in_stock', t('inStock')], ['sold', t('sold')], ['repair', t('repair')], ['all', t('all')]]} />
          {!phones ? <Loading /> : !phones.length ? (
            <Empty icon="phone-portrait-outline" title={t('noPhones')} text={t('noPhonesHint')} />
          ) : (
            <>
              <Muted style={{ marginBottom: 8 }}>{phones.length} · {t('stockValue')}: {money(value)}</Muted>
              <Card flush>
                {phones.map((p, i) => <PhoneRow key={p.id} p={p} last={i === phones.length - 1} />)}
              </Card>
            </>
          )}
        </>
      ) : !acc ? <Loading /> : !acc.length ? (
        <Empty icon="headset-outline" title={t('noAccessories')} text={t('noAccessoriesHint')} />
      ) : (
        <Card flush>
          {acc.map((a, i) => (
            <ListItem key={a.id} last={i === acc.length - 1} onPress={() => router.push(`/accessory/${a.id}`)}
              left={<Avatar icon="headset-outline" />} title={a.name} sub={[a.category, a.sku].filter(Boolean).join(' · ') || ' '}
              trail={<View style={{ alignItems: 'flex-end' }}><T bold size={14} num>{money(a.price)}</T><Badge tone={a.minQty > 0 && a.qty <= a.minQty ? 'red' : 'slate'} label={`${t('qty')} ${a.qty}`} /></View>} />
          ))}
        </Card>
      )}
    </Screen>
  );
}

function PhoneRow({ p, last }: { p: Phone; last: boolean }) {
  const { t, money } = useApp();
  return (
    <ListItem last={last} onPress={() => router.push(`/phone/${p.id}`)} left={<Avatar icon="phone-portrait-outline" />}
      title={`${p.brand} ${p.model}${p.storage ? ' ' + p.storage : ''}`} sub={`IMEI ${p.imei1}`}
      sub2={[p.condition === 'used' ? `${t('condUsed')}${p.grade ? ' ' + p.grade : ''}` : t('condNew'), p.color].filter(Boolean).join(' · ')}
      trail={<View style={{ alignItems: 'flex-end', gap: 4 }}><T bold size={14} num>{money(p.price)}</T>{p.status !== 'in_stock' ? <Badge tone={p.status === 'sold' ? 'teal' : 'amber'} label={t('st_' + p.status)} /> : null}</View>} />
  );
}
