import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import type { Accessory, PhoneDraft } from '../../db/types';
import { todayStr } from '../../lib/dates';
import { C } from '../../lib/theme';
import { useCan } from '../../license/LicenseGate';
import { Button, Card, Credit, Field, FullModal, IconButton, KV, ListItem, Muted, NumField, Row, Screen, SectionLabel, SelectField, T } from '../../ui/kit';
import { AccountPicker, PartyPicker, PendingDocs, savePendingDocs, type PendingDoc } from '../../ui/pickers';
import { DraftState, emptyDraft, PhoneForm, toDraft } from '../../ui/PhoneForm';

interface AccLine { accessoryId: number; name: string; qty: number; cost: number }

/** Stock coming in: new phones from a supplier, used phones bought from a customer, accessories — one bill. */
export default function NewPurchase() {
  const { t, toast, branchId, money } = useApp();
  const can = useCan();
  const [partyId, setPartyId] = useState<number | null>(null);
  const [date, setDate] = useState(todayStr());
  const [phones, setPhones] = useState<PhoneDraft[]>([]);
  const [lines, setLines] = useState<AccLine[]>([]);
  const [paid, setPaid] = useState('');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [docs, setDocs] = useState<PendingDoc[]>([]);
  const [note, setNote] = useState('');
  const [form, setForm] = useState<DraftState | null>(null);
  const [accList, setAccList] = useState<Accessory[]>([]);
  const [accSel, setAccSel] = useState(''); const [accQty, setAccQty] = useState(''); const [accCost, setAccCost] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { Repo.listAccessories({ branchId }).then(setAccList); }, [branchId]);
  const total = useMemo(() => phones.reduce((s, p) => s + p.cost, 0) + lines.reduce((s, l) => s + l.qty * l.cost, 0), [phones, lines]);
  const paidNum = Number(paid) || 0;

  const addPhone = () => {
    try {
      const d = toDraft(form!);
      if (phones.some((p) => p.imei1 === d.imei1)) throw new Error(t('imeiTwice'));
      setPhones([...phones, d]); setForm(null);
    } catch (e: any) { toast(e.message, 'error'); }
  };
  const addAcc = () => {
    const a = accList.find((x) => String(x.id) === accSel);
    const qty = Number(accQty); const cost = accCost === '' ? a?.cost ?? 0 : Number(accCost);
    if (!a || !(qty > 0) || !(cost >= 0)) { toast(t('enterQtyCost'), 'error'); return; }
    setLines([...lines, { accessoryId: a.id, name: a.name, qty, cost }]); setAccSel(''); setAccQty(''); setAccCost('');
  };
  const save = async () => {
    setSaving(true);
    try {
      const id = await Repo.createPurchase({
        branchId, partyId, date, phones, accessories: lines.map(({ accessoryId, qty, cost }) => ({ accessoryId, qty, cost })),
        paid: paidNum, accountId: paidNum > 0 ? accountId : null, note,
      });
      await savePendingDocs('purchase', id, docs);
      toast(t('saved'), 'success'); router.back();
    } catch (e: any) { toast(e.message, 'error'); }
    setSaving(false);
  };

  return (
    <Screen back title={t('newPurchase')}>
      <Card>
        <PartyPicker label={t('supplierOrSeller')} value={partyId} onChange={setPartyId} optional />
        <Field label={t('date')} value={date} onChangeText={setDate} ltr placeholder="YYYY-MM-DD" />
      </Card>

      <SectionLabel right={<Button small variant="ghost" icon="add" label={t('addPhone')} onPress={() => setForm(emptyDraft())} />}>{t('phones')}</SectionLabel>
      {phones.length ? (
        <Card flush>
          {phones.map((p, i) => (
            <ListItem key={p.imei1} last={i === phones.length - 1} title={`${p.brand} ${p.model}${p.storage ? ' ' + p.storage : ''}`} sub={`IMEI ${p.imei1}`}
              sub2={`${p.condition === 'used' ? t('condUsed') : t('condNew')} · ${money(p.cost)} → ${money(p.price)}`}
              trail={<IconButton icon="trash-outline" color={C.danger} onPress={() => setPhones(phones.filter((x) => x !== p))} />} />
          ))}
        </Card>
      ) : <Muted>{t('noPhonesAdded')}</Muted>}

      {can('inventory.accessories') ? (
        <>
          <SectionLabel>{t('accessories')}</SectionLabel>
          {lines.length ? (
            <Card flush>
              {lines.map((l, i) => (
                <ListItem key={i} last={i === lines.length - 1} title={l.name} sub={`${l.qty} × ${money(l.cost)}`} trail={<Row gap={8}><T bold num>{money(l.qty * l.cost)}</T><IconButton icon="trash-outline" color={C.danger} onPress={() => setLines(lines.filter((x) => x !== l))} /></Row>} />
              ))}
            </Card>
          ) : null}
          <Card>
            <SelectField label={t('accessory')} value={accSel} searchable options={accList.map((a) => ({ value: String(a.id), label: a.name, sub: `${t('qty')} ${a.qty}` }))}
              onChange={(v) => { setAccSel(v); const a = accList.find((x) => String(x.id) === v); if (a) setAccCost(String(a.cost)); }}
              footer={<View style={{ marginTop: 12 }}><Button variant="ghost" icon="add" label={t('newAccessory')} onPress={() => router.push('/accessory/new')} /></View>} />
            <Row gap={10} align="flex-start">
              <View style={{ flex: 1 }}><NumField label={t('qty')} value={accQty} onChangeText={setAccQty} /></View>
              <View style={{ flex: 1 }}><NumField label={t('costEach')} value={accCost} onChangeText={setAccCost} /></View>
            </Row>
            <Button variant="ghost" icon="add" label={t('addLine')} onPress={addAcc} disabled={!accSel} />
          </Card>
        </>
      ) : null}

      <SectionLabel>{t('payment')}</SectionLabel>
      <Card>
        <KV k={t('total')} v={money(total)} />
        <View style={{ height: 12 }} />
        <NumField label={t('paidNow')} value={paid} onChangeText={setPaid} />
        {paidNum > 0 ? <AccountPicker value={accountId} onChange={setAccountId} branchId={branchId} /> : null}
        <KV k={t('stillOwed')} v={money(Math.max(0, total - paidNum))} vColor={total - paidNum > 0 ? C.danger : undefined} />
      </Card>

      {can('sales.documents') ? (
        <>
          <SectionLabel>{t('documents')}</SectionLabel>
          <Card><Muted style={{ marginBottom: 8 }}>{t('sellerDocHint')}</Muted><PendingDocs value={docs} onChange={setDocs} /></Card>
        </>
      ) : null}
      <Field label={t('notes')} value={note} onChangeText={setNote} multiline />
      <Button label={t('savePurchase')} onPress={save} loading={saving} disabled={!phones.length && !lines.length} />

      <FullModal visible={!!form} title={t('addPhone')} onClose={() => setForm(null)} footer={<Button label={t('addToPurchase')} onPress={addPhone} />}>
        {form ? <PhoneForm value={form} onChange={setForm} /> : null}
      </FullModal>
      <Credit />
    </Screen>
  );
}
