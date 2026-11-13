import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import type { Accessory, Phone } from '../../db/types';
import { C } from '../../lib/theme';
import { Badge, Button, Field, KV, Muted, Row, Screen, Sheet, T } from '../../ui/kit';
import { ScannerView } from '../../ui/Scanner';

/** Scan a product QR label or an IMEI barcode: open it, or sell it straight away. */
export default function ScanTab() {
  const { t, money, toast } = useApp();
  const [focused, setFocused] = useState(false);
  const [found, setFound] = useState<{ phone?: Phone; accessory?: Accessory } | null>(null);
  const [manual, setManual] = useState('');
  useFocusEffect(useCallback(() => { setFocused(true); return () => { setFocused(false); setFound(null); }; }, []));

  const lookup = async (code: string) => {
    const c = code.trim();
    if (!c) return;
    let r = await Repo.resolveScan(c);
    // typed partial IMEI (last digits) or model name: take it when exactly one phone matches
    if (!r && c.length >= 4) { const hits = await Repo.listPhones({ q: c, status: 'in_stock' }); if (hits.length === 1) r = { type: 'phone', phone: hits[0] }; }
    if (!r) { toast(t('notFound'), 'error'); return; }
    setFound(r.type === 'phone' ? { phone: r.phone } : { accessory: r.accessory });
  };

  return (
    <Screen title={t('scanTitle')} scroll={false}>
      <View style={{ flex: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' }}>
        {focused ? <ScannerView onScan={lookup} paused={!!found} /> : null}
      </View>
      <View style={{ height: 12 }} />
      <Row gap={10} align="flex-end">
        <View style={{ flex: 1 }}><Field label={t('typeImei')} value={manual} onChangeText={setManual} keyboardType="number-pad" ltr style={{ marginBottom: 0 }} /></View>
        <Button label={t('find')} onPress={() => lookup(manual)} disabled={manual.trim().length < 4} />
      </Row>

      <Sheet visible={!!found} onClose={() => setFound(null)} title={found?.phone ? `${found.phone.brand} ${found.phone.model}` : found?.accessory?.name}>
        {found?.phone ? (
          <>
            <KV k="IMEI" v={found.phone.imei1} />
            <KV k={t('sellPrice')} v={money(found.phone.price)} />
            <View style={{ marginVertical: 10 }}><Badge tone={found.phone.status === 'in_stock' ? 'indigo' : 'teal'} label={t('st_' + found.phone.status)} /></View>
            <Row gap={10}>
              {found.phone.status === 'in_stock' ? <Button block icon="cart-outline" label={t('sell')} onPress={() => { const id = found.phone!.id; setFound(null); router.push({ pathname: '/sale/new', params: { phoneId: String(id) } }); }} /> : null}
              <Button block variant="ghost" label={t('open')} onPress={() => { const id = found.phone!.id; setFound(null); router.push(`/phone/${id}`); }} />
            </Row>
          </>
        ) : found?.accessory ? (
          <>
            <KV k={t('qty')} v={String(found.accessory.qty)} vColor={found.accessory.qty <= found.accessory.minQty ? C.danger : undefined} />
            <KV k={t('sellPrice')} v={money(found.accessory.price)} />
            <View style={{ height: 10 }} />
            <Row gap={10}>
              {found.accessory.qty > 0 ? <Button block icon="cart-outline" label={t('sell')} onPress={() => { const id = found.accessory!.id; setFound(null); router.push({ pathname: '/sale/new', params: { accessoryId: String(id) } }); }} /> : null}
              <Button block variant="ghost" label={t('open')} onPress={() => { const id = found.accessory!.id; setFound(null); router.push(`/accessory/${id}`); }} />
            </Row>
          </>
        ) : <Muted>{' '}</Muted>}
      </Sheet>
    </Screen>
  );
}
