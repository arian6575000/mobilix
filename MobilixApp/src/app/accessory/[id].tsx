import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import { labelsHtml, accessoryLabel, printHtml } from '../../lib/receipt';
import { C } from '../../lib/theme';
import { useCan } from '../../license/LicenseGate';
import { Button, Card, Credit, Field, KV, Loading, NumField, Row, Screen, SectionLabel, Sheet, T } from '../../ui/kit';
import { Qr } from '../../ui/Qr';

/** One screen for "new accessory" (id = new) and for viewing / editing an existing one. */
export default function AccessoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { t, toast, branchId, settings, money } = useApp();
  const can = useCan();
  const [loaded, setLoaded] = useState(isNew);
  const [qr, setQr] = useState('');
  const [qty, setQty] = useState(0);
  const [f, setF] = useState({ name: '', category: '', sku: '', qty: '', minQty: '', cost: '', price: '' });
  const [adj, setAdj] = useState(false); const [delta, setDelta] = useState('');
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const load = async () => {
    const a = await Repo.getAccessory(Number(id));
    if (!a) return;
    setQr(a.qr); setQty(a.qty);
    setF({ name: a.name, category: a.category, sku: a.sku, qty: String(a.qty), minQty: String(a.minQty), cost: String(a.cost), price: String(a.price) });
    setLoaded(true);
  };
  useEffect(() => { if (!isNew) load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    try {
      const base = { name: f.name, category: f.category, sku: f.sku, minQty: Number(f.minQty) || 0, cost: Number(f.cost), price: Number(f.price) };
      if (!(Number(f.cost) >= 0) || f.cost === '' || !(Number(f.price) >= 0) || f.price === '') throw new Error(t('enterPrices'));
      if (isNew) { await Repo.addAccessory(branchId, { ...base, qty: Number(f.qty) || 0 }); toast(t('saved'), 'success'); router.back(); }
      else { await Repo.updateAccessory(Number(id), base); toast(t('saved'), 'success'); await load(); }
    } catch (e: any) { toast(e.message, 'error'); }
  };
  const doAdjust = async () => {
    try { await Repo.adjustAccessory(Number(id), Number(delta)); setAdj(false); setDelta(''); await load(); toast(t('saved'), 'success'); }
    catch (e: any) { toast(e.message, 'error'); }
  };
  const label = async () => {
    const a = await Repo.getAccessory(Number(id)); if (!a) return;
    try { await printHtml(await labelsHtml([accessoryLabel(a)], settings, 'a4'), 'a4'); } catch (e: any) { toast(e.message, 'error'); }
  };
  if (!loaded) return <Screen back title=" "><Loading /></Screen>;

  return (
    <Screen back title={isNew ? t('newAccessory') : f.name}>
      {!isNew ? (
        <Card style={{ alignItems: 'center' }}>
          <Qr value={qr} size={120} />
          <T bold size={26} num style={{ marginTop: 10 }}>{qty}</T>
          <T size={13} color={C.faint}>{t('inStock')}</T>
          <Row gap={10} style={{ marginTop: 12 }}>
            <Button small variant="ghost" icon="swap-vertical-outline" label={t('adjustStock')} onPress={() => setAdj(true)} />
            {can('inventory.qr') ? <Button small variant="ghost" icon="qr-code-outline" label={t('printLabel')} onPress={label} /> : null}
          </Row>
        </Card>
      ) : null}
      <Card>
        <Field label={t('name')} value={f.name} onChangeText={set('name')} autoCapitalize="words" />
        <Field label={t('category')} value={f.category} onChangeText={set('category')} />
        <Field label={t('sku')} value={f.sku} onChangeText={set('sku')} ltr />
        <Row gap={10} align="flex-start">
          <View style={{ flex: 1 }}><NumField label={t('costPrice')} value={f.cost} onChangeText={set('cost')} /></View>
          <View style={{ flex: 1 }}><NumField label={t('sellPrice')} value={f.price} onChangeText={set('price')} /></View>
        </Row>
        <Row gap={10} align="flex-start">
          {isNew ? <View style={{ flex: 1 }}><NumField label={t('openingQty')} value={f.qty} onChangeText={set('qty')} /></View> : null}
          <View style={{ flex: 1 }}><NumField label={t('lowStockAt')} value={f.minQty} onChangeText={set('minQty')} /></View>
        </Row>
        <Button label={t('save')} onPress={save} disabled={!f.name.trim()} />
      </Card>
      {!isNew ? <Button variant="ghost" icon="cart-outline" label={t('sell')} onPress={() => router.push({ pathname: '/sale/new', params: { accessoryId: String(id) } })} /> : null}
      <Sheet visible={adj} onClose={() => setAdj(false)} title={t('adjustStock')}>
        <T color={C.faint} size={13} style={{ marginBottom: 10 }}>{t('adjustHint')}</T>
        <Field label={t('change')} value={delta} onChangeText={setDelta} keyboardType="numbers-and-punctuation" ltr placeholder="+10 / -2" />
        <Button label={t('save')} onPress={doAdjust} disabled={!delta.trim() || !Number(delta)} />
      </Sheet>
      <Credit />
    </Screen>
  );
}
