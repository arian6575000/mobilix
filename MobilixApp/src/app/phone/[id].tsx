import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import type { PhoneStatus } from '../../db/types';
import { useLoad } from '../../lib/hooks';
import { C } from '../../lib/theme';
import { labelsHtml, phoneLabel, printHtml } from '../../lib/receipt';
import { useCan } from '../../license/LicenseGate';
import { Badge, Button, Card, Credit, Field, KV, Loading, NumField, Row, Screen, SectionLabel, SelectField, Sheet, T } from '../../ui/kit';
import { DocsSection } from '../../ui/pickers';
import { Qr } from '../../ui/Qr';

export default function PhoneDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, money, settings, toast, confirm, viewBranch } = useApp();
  const can = useCan();
  const [p, reload] = useLoad(() => Repo.getPhone(Number(id)), [id]);
  const [sale] = useLoad(() => Repo.saleOfPhone(Number(id)), [id]);
  const [branches] = useLoad(() => Repo.listBranches(), []);
  const [edit, setEdit] = useState(false);
  const [price, setPrice] = useState(''); const [cost, setCost] = useState(''); const [notes, setNotes] = useState('');
  const [move, setMove] = useState(false);

  const openEdit = useCallback(() => { if (!p) return; setPrice(String(p.price)); setCost(String(p.cost)); setNotes(p.notes); setEdit(true); }, [p]);
  if (!p) return <Screen back title=" "><Loading /></Screen>;

  const save = async () => {
    try { await Repo.updatePhone(p.id, { price: Number(price), cost: Number(cost), notes }); setEdit(false); await reload(); toast(t('saved'), 'success'); }
    catch (e: any) { toast(e.message, 'error'); }
  };
  const setStatus = async (s: PhoneStatus) => { try { await Repo.updatePhone(p.id, { status: s }); await reload(); } catch (e: any) { toast(e.message, 'error'); } };
  const label = async () => { try { await printHtml(await labelsHtml([phoneLabel(p)], settings, 'a4'), 'a4'); } catch (e: any) { toast(e.message, 'error'); } };
  const transfer = async (branchId: number) => {
    setMove(false);
    if (branchId === p.branchId) return;
    if (!(await confirm(t('transferConfirm')))) return;
    try { await Repo.transferPhone(p.id, branchId); await reload(); toast(t('saved'), 'success'); } catch (e: any) { toast(e.message, 'error'); }
  };
  const profit = p.price - p.cost;

  return (
    <Screen back title={`${p.brand} ${p.model}`} subtitle={p.storage || undefined}>
      <Card style={{ alignItems: 'center' }}>
        <Qr value={p.qr} size={150} />
        <T size={13} color={C.faint} style={{ marginTop: 8 }} selectable>IMEI {p.imei1}</T>
        <View style={{ marginTop: 8 }}><Badge tone={p.status === 'in_stock' ? 'indigo' : p.status === 'sold' ? 'teal' : 'amber'} label={t('st_' + p.status)} /></View>
      </Card>

      <Card flush>
        <KV k={t('condition')} v={p.condition === 'used' ? `${t('condUsed')}${p.grade ? ' · ' + p.grade : ''}` : t('condNew')} />
        {p.storage || p.ram ? <KV k={t('storage')} v={[p.storage, p.ram].filter(Boolean).join(' / ')} /> : null}
        {p.color ? <KV k={t('color')} v={p.color} /> : null}
        <KV k={t('ptaStatus')} v={t(p.pta === 'approved' ? 'ptaApproved' : p.pta === 'non_pta' ? 'ptaNon' : 'ptaUnknown')} />
        {p.battery !== null ? <KV k={t('batteryHealth')} v={`${p.battery}%`} /> : null}
        {p.imei2 ? <KV k={t('imei2')} v={p.imei2} /> : null}
        <KV k={t('costPrice')} v={money(p.cost)} />
        <KV k={t('sellPrice')} v={money(p.price)} />
        <KV k={t('margin')} v={money(profit)} vColor={profit > 0 ? C.success : profit < 0 ? C.danger : undefined} />
        {p.notes ? <KV k={t('notes')} v={p.notes} /> : null}
      </Card>

      {p.status === 'in_stock' ? (
        <Button icon="cart-outline" label={t('sellThisPhone')} onPress={() => router.push({ pathname: '/sale/new', params: { phoneId: String(p.id) } })} />
      ) : sale ? <Button variant="ghost" icon="receipt-outline" label={`${t('viewInvoice')} ${sale.invoiceNo}`} onPress={() => router.push(`/sale/${sale.saleId}`)} /> : null}
      <View style={{ height: 10 }} />
      <Row gap={10}>
        <Button block variant="ghost" icon="create-outline" label={t('edit')} onPress={openEdit} />
        {can('inventory.qr') ? <Button block variant="ghost" icon="qr-code-outline" label={t('printLabel')} onPress={label} /> : null}
      </Row>
      {p.status !== 'sold' ? (
        <>
          <View style={{ height: 10 }} />
          <Row gap={10}>
            {p.status === 'in_stock' ? <Button block variant="ghost" icon="construct-outline" label={t('sendToRepair')} onPress={() => setStatus('repair')} /> : <Button block variant="ghost" icon="checkmark-circle-outline" label={t('backInStock')} onPress={() => setStatus('in_stock')} />}
            {can('branches.multi') && (branches || []).length > 1 && p.status === 'in_stock' ? <Button block variant="ghost" icon="swap-horizontal-outline" label={t('transfer')} onPress={() => setMove(true)} /> : null}
          </Row>
        </>
      ) : null}

      <SectionLabel>{t('documents')}</SectionLabel>
      <Card><DocsSection ownerType="phone" ownerId={p.id} /></Card>

      <Sheet visible={edit} onClose={() => setEdit(false)} title={t('edit')}>
        <Row gap={10} align="flex-start">
          <View style={{ flex: 1 }}><NumField label={t('costPrice')} value={cost} onChangeText={setCost} /></View>
          <View style={{ flex: 1 }}><NumField label={t('sellPrice')} value={price} onChangeText={setPrice} /></View>
        </Row>
        <Field label={t('notes')} value={notes} onChangeText={setNotes} multiline />
        <Button label={t('save')} onPress={save} />
      </Sheet>
      <Sheet visible={move} onClose={() => setMove(false)} title={t('transfer')}>
        {(branches || []).filter((b) => b.id !== p.branchId).map((b) => <Button key={b.id} variant="ghost" label={b.name} onPress={() => transfer(b.id)} style={{ marginBottom: 8 }} />)}
      </Sheet>
      <Credit />
    </Screen>
  );
}
