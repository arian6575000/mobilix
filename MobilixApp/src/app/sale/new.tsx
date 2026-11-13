import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import type { Accessory, Phone, PhoneDraft, SaleKind, SaleLine } from '../../db/types';
import { addMonths, todayStr } from '../../lib/dates';
import { buildSchedule } from '../../lib/installments';
import { C } from '../../lib/theme';
import { useCan } from '../../license/LicenseGate';
import { Button, Card, Credit, Field, FullModal, IconButton, KV, Muted, NumField, Row, Screen, SectionLabel, Segmented, SelectField, T } from '../../ui/kit';
import { AccountPicker, PartyPicker, PendingDocs, savePendingDocs, type PendingDoc } from '../../ui/pickers';
import { DraftState, emptyDraft, PhoneForm, toDraft } from '../../ui/PhoneForm';
import { useScanner } from '../../ui/Scanner';

interface Line { key: string; kind: 'phone' | 'accessory'; refId: number; label: string; sub: string; qty: number; price: string; maxQty: number }

export default function NewSale() {
  const { phoneId, accessoryId } = useLocalSearchParams<{ phoneId?: string; accessoryId?: string }>();
  const { t, toast, branchId, money, settings } = useApp();
  const can = useCan();
  const [scanEl, scan] = useScanner();

  const [lines, setLines] = useState<Line[]>([]);
  const [partyId, setPartyId] = useState<number | null>(null);
  const [kind, setKind] = useState<SaleKind>('cash');
  const [date, setDate] = useState(todayStr());
  const [discount, setDiscount] = useState('');
  const [paid, setPaid] = useState('');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [months, setMonths] = useState('6');
  const [markup, setMarkup] = useState('');
  const [firstDue, setFirstDue] = useState(addMonths(todayStr(), 1));
  const [gName, setGName] = useState(''); const [gPhone, setGPhone] = useState(''); const [gCnic, setGCnic] = useState('');
  const [exForm, setExForm] = useState<DraftState | null>(null); const [exValue, setExValue] = useState('');
  const [exchange, setExchange] = useState<(PhoneDraft & { value: number }) | null>(null);
  const [docs, setDocs] = useState<PendingDoc[]>([]);
  const [note, setNote] = useState('');
  const [stock, setStock] = useState<Phone[]>([]);
  const [acc, setAcc] = useState<Accessory[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setStock(await Repo.listPhones({ branchId, status: 'in_stock' }));
      setAcc((await Repo.listAccessories({ branchId })).filter((a) => a.qty > 0));
    })();
  }, [branchId]);

  // opened from a phone / accessory screen: start with it in the cart
  useEffect(() => {
    (async () => {
      if (phoneId) { const p = await Repo.getPhone(Number(phoneId)); if (p) addPhone(p); }
      if (accessoryId) { const a = await Repo.getAccessory(Number(accessoryId)); if (a) addAccessory(a); }
    })();
  }, [phoneId, accessoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addPhone = (p: Phone) => {
    if (p.status !== 'in_stock') { toast(t('notInStock'), 'error'); return; }
    setLines((ls) => ls.some((l) => l.key === `p${p.id}`) ? ls : [...ls, { key: `p${p.id}`, kind: 'phone', refId: p.id, label: `${p.brand} ${p.model}${p.storage ? ' ' + p.storage : ''}`, sub: `IMEI ${p.imei1}`, qty: 1, price: String(p.price), maxQty: 1 }]);
  };
  const addAccessory = (a: Accessory) => {
    setLines((ls) => {
      const cur = ls.find((l) => l.key === `a${a.id}`);
      if (cur) return ls.map((l) => (l === cur ? { ...l, qty: Math.min(l.qty + 1, a.qty) } : l));
      return [...ls, { key: `a${a.id}`, kind: 'accessory', refId: a.id, label: a.name, sub: a.category, qty: 1, price: String(a.price), maxQty: a.qty }];
    });
  };
  const scanAdd = async () => {
    const code = await scan();
    if (!code) return;
    const r = await Repo.resolveScan(code);
    if (!r) { toast(t('notFound'), 'error'); return; }
    if (r.type === 'phone') {
      if (r.phone.branchId !== branchId) { toast(t('otherBranch'), 'error'); return; }
      addPhone(r.phone);
    } else addAccessory(r.accessory);
  };

  const setLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const subtotal = useMemo(() => lines.reduce((s, l) => s + (Number(l.price) || 0) * l.qty, 0), [lines]);
  const disc = Number(discount) || 0;
  const mk = kind === 'installment' ? Number(markup) || 0 : 0;
  const total = Math.max(0, subtotal - disc + mk);
  const exVal = exchange?.value ?? 0;
  const net = Math.max(0, total - exVal);
  const paidNow = kind === 'cash' ? net : Math.min(Number(paid) || 0, net);
  const remaining = net - paidNow;
  const schedule = useMemo(() => {
    if (kind !== 'installment' || remaining <= 0) return null;
    try { return buildSchedule(remaining, Number(months), firstDue); } catch { return null; }
  }, [kind, remaining, months, firstDue]);

  const saveExchange = () => {
    try {
      const d = toDraft({ ...exForm!, cost: '0' });
      const value = Number(exValue);
      if (!(value >= 0) || exValue.trim() === '') throw new Error(t('enterTradeValue'));
      setExchange({ ...d, value }); setExForm(null);
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const items: SaleLine[] = lines.map((l) => l.kind === 'phone'
        ? { kind: 'phone', phoneId: l.refId, price: Number(l.price) || 0 }
        : { kind: 'accessory', accessoryId: l.refId, qty: l.qty, price: Number(l.price) || 0 });
      const id = await Repo.createSale({
        branchId, partyId, date, kind, items, discount: disc, exchange, paid: paidNow, accountId: paidNow > 0 ? accountId : null, note,
        invoicePrefix: settings.invoicePrefix,
        plan: kind === 'installment' ? { months: Number(months), markup: mk, firstDue, guarantorName: gName, guarantorPhone: gPhone, guarantorCnic: gCnic } : null,
      });
      await savePendingDocs('sale', id, docs);
      router.replace(`/sale/${id}`);
    } catch (e: any) { toast(e.message, 'error'); }
    setSaving(false);
  };

  const kinds: [SaleKind, string][] = [['cash', t('kindCash')], ['credit', t('kindCredit')]];
  if (can('sales.installments')) kinds.push(['installment', t('kindInstallment')]);

  return (
    <Screen back title={t('newSale')}>
      <Row gap={10}>
        <Button block icon="qr-code-outline" label={t('scanToAdd')} onPress={scanAdd} />
      </Row>
      <View style={{ height: 12 }} />
      <Card>
        <SelectField label={t('addPhone')} value="" searchable placeholder={t('searchInStock')}
          options={stock.filter((p) => !lines.some((l) => l.key === `p${p.id}`)).map((p) => ({ value: String(p.id), label: `${p.brand} ${p.model}${p.storage ? ' ' + p.storage : ''}`, sub: `IMEI ${p.imei1} · ${money(p.price)}` }))}
          onChange={(v) => { const p = stock.find((x) => String(x.id) === v); if (p) addPhone(p); }} />
        {can('inventory.accessories') ? (
          <SelectField label={t('addAccessory')} value="" searchable placeholder={t('select')}
            options={acc.map((a) => ({ value: String(a.id), label: a.name, sub: `${t('qty')} ${a.qty} · ${money(a.price)}` }))}
            onChange={(v) => { const a = acc.find((x) => String(x.id) === v); if (a) addAccessory(a); }} />
        ) : null}
      </Card>

      {lines.map((l) => (
        <Card key={l.key}>
          <Row gap={8} style={{ justifyContent: 'space-between' }} align="flex-start">
            <View style={{ flex: 1 }}><T bold>{l.label}</T>{l.sub ? <Muted>{l.sub}</Muted> : null}</View>
            <IconButton icon="trash-outline" color={C.danger} onPress={() => setLines(lines.filter((x) => x.key !== l.key))} />
          </Row>
          <View style={{ height: 10 }} />
          <Row gap={10} align="flex-start">
            {l.kind === 'accessory' ? <View style={{ flex: 1 }}><NumField label={`${t('qty')} (≤ ${l.maxQty})`} value={String(l.qty)} onChangeText={(v) => setLine(l.key, { qty: Math.min(Math.max(Number(v) || 0, 0), l.maxQty) })} /></View> : null}
            <View style={{ flex: 1 }}><NumField label={t('price')} value={l.price} onChangeText={(v) => setLine(l.key, { price: v })} /></View>
          </Row>
        </Card>
      ))}
      {!lines.length ? <Muted center style={{ marginVertical: 12 }}>{t('cartEmpty')}</Muted> : null}

      <SectionLabel>{t('customer')}</SectionLabel>
      <Card>
        <PartyPicker label={t('customer')} value={partyId} onChange={setPartyId} kind="customer" optional={kind === 'cash'} />
        <T size={12.5} bold color={C.soft} style={{ marginBottom: 6 }}>{t('saleType')}</T>
        <Segmented value={kind} onChange={setKind} items={kinds} />
        <View style={{ height: 14 }} />
        <Field label={t('date')} value={date} onChangeText={setDate} ltr placeholder="YYYY-MM-DD" />
        <NumField label={t('discount')} value={discount} onChangeText={setDiscount} />
        {can('sales.exchange') ? (
          exchange ? (
            <Row gap={10} style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flex: 1 }}><T bold size={14}>{t('tradeIn')}: {exchange.brand} {exchange.model}</T><Muted>IMEI {exchange.imei1} · {money(exchange.value)}</Muted></View>
              <IconButton icon="close" onPress={() => setExchange(null)} />
            </Row>
          ) : <Button small variant="ghost" icon="swap-horizontal-outline" label={t('addTradeIn')} onPress={() => { setExForm({ ...emptyDraft(), condition: 'used' }); setExValue(''); }} style={{ alignSelf: 'flex-start' }} />
        ) : null}
      </Card>

      {kind === 'installment' ? (
        <>
          <SectionLabel>{t('installmentPlan')}</SectionLabel>
          <Card>
            <Row gap={10} align="flex-start">
              <View style={{ flex: 1 }}><NumField label={t('months')} value={months} onChangeText={setMonths} /></View>
              <View style={{ flex: 1 }}><NumField label={t('extraCharges')} value={markup} onChangeText={setMarkup} /></View>
            </Row>
            <Field label={t('firstDue')} value={firstDue} onChangeText={setFirstDue} ltr placeholder="YYYY-MM-DD" />
            {schedule ? <KV k={t('perMonth')} v={`${money(schedule[0].amount)} × ${schedule.length}`} /> : null}
            <View style={{ height: 8 }} />
            <T size={12.5} bold color={C.soft} style={{ marginBottom: 6 }}>{t('guarantor')}</T>
            <Field label={t('name')} value={gName} onChangeText={setGName} />
            <Field label={t('phone')} value={gPhone} onChangeText={setGPhone} keyboardType="phone-pad" ltr />
            <Field label={t('cnic')} value={gCnic} onChangeText={setGCnic} ltr />
          </Card>
        </>
      ) : null}

      <SectionLabel>{t('payment')}</SectionLabel>
      <Card>
        <KV k={t('subtotal')} v={money(subtotal)} />
        {disc ? <KV k={t('discount')} v={`-${money(disc)}`} /> : null}
        {mk ? <KV k={t('extraCharges')} v={money(mk)} /> : null}
        <KV k={t('total')} v={money(total)} />
        {exVal ? <KV k={t('tradeIn')} v={`-${money(exVal)}`} /> : null}
        <View style={{ height: 12 }} />
        {kind === 'cash' ? <KV k={t('received')} v={money(net)} vColor={C.success} /> : <NumField label={kind === 'installment' ? t('advance') : t('paidNow')} value={paid} onChangeText={setPaid} />}
        {paidNow > 0 ? <AccountPicker value={accountId} onChange={setAccountId} branchId={branchId} /> : null}
        {kind !== 'cash' ? <KV k={t('balanceDue')} v={money(remaining)} vColor={remaining > 0 ? C.danger : undefined} /> : null}
      </Card>

      {can('sales.documents') ? (
        <>
          <SectionLabel>{t('documents')}</SectionLabel>
          <Card><Muted style={{ marginBottom: 8 }}>{t('saleDocHint')}</Muted><PendingDocs value={docs} onChange={setDocs} /></Card>
        </>
      ) : null}
      <Field label={t('notes')} value={note} onChangeText={setNote} multiline />
      <Button icon="checkmark" label={t('completeSale')} onPress={save} loading={saving} disabled={!lines.length} />

      <FullModal visible={!!exForm} title={t('tradeIn')} onClose={() => setExForm(null)} footer={<Button label={t('save')} onPress={saveExchange} />}>
        {exForm ? (
          <>
            <NumField label={t('tradeValue')} value={exValue} onChangeText={setExValue} />
            <PhoneForm value={exForm} onChange={setExForm} hideCost />
          </>
        ) : null}
      </FullModal>
      {scanEl}
      <Credit />
    </Screen>
  );
}
