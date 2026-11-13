import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import { Fmt } from '../../lib/format';
import { todayStr } from '../../lib/dates';
import { useLoad } from '../../lib/hooks';
import { Paper, printHtml, saleReceiptHtml, shareHtmlPdf } from '../../lib/receipt';
import { openWhatsApp } from '../../lib/whatsapp';
import { C } from '../../lib/theme';
import { useCan } from '../../license/LicenseGate';
import { Badge, Button, Card, Chips, Credit, Field, KV, Loading, Muted, NumField, Row, Screen, SectionLabel, Sheet, T } from '../../ui/kit';
import { AccountPicker, DocsSection } from '../../ui/pickers';

export default function SaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, money, settings, toast, branchId, lang } = useApp();
  const can = useCan();
  const [d, reload] = useLoad(() => Repo.getSale(Number(id)), [id]);
  const [paper, setPaper] = useState<'a4' | '58' | '80'>(String(settings.paperWidth) as any);
  const [pay, setPay] = useState(false);
  const [amount, setAmount] = useState(''); const [accountId, setAccountId] = useState<number | null>(null); const [pdate, setPdate] = useState(todayStr());
  if (!d) return <Screen back title=" "><Loading /></Screen>;
  const { sale, party, items, payments, plan, installments } = d;
  const today = todayStr();
  const paperVal: Paper = paper === 'a4' ? 'a4' : (Number(paper) as 58 | 80);

  const openPay = () => {
    const next = installments.find((i) => i.paid < i.amount);
    setAmount(String(next ? Math.min(next.amount - next.paid, sale.due) : sale.due)); setPdate(todayStr()); setPay(true);
  };
  const doPay = async () => {
    try { await Repo.receiveSalePayment({ saleId: sale.id, amount: Number(amount), accountId: accountId!, date: pdate }); setPay(false); await reload(); toast(t('saved'), 'success'); }
    catch (e: any) { toast(e.message, 'error'); }
  };
  const run = (fn: () => Promise<void>) => async () => { try { await fn(); } catch (e: any) { toast(e.message, 'error'); } };
  const html = () => saleReceiptHtml(d, settings, paperVal);
  const remind = run(async () => {
    if (!party?.phone) { toast(t('noPhoneNumber'), 'error'); return; }
    const next = installments.find((i) => i.paid < i.amount);
    const msg = `Assalam o Alaikum ${party.name},\n${settings.shopName || 'Mobilix'}: your balance on invoice ${sale.invoiceNo} is ${Fmt.money(sale.due, settings.currency)}.` +
      (next ? ` Next installment ${Fmt.money(next.amount - next.paid, settings.currency)} is due on ${Fmt.date(next.dueDate, 'en')}.` : '') + ' Thank you.';
    await openWhatsApp(party.phone, msg, settings.countryCode);
  });
  const sendReceipt = run(async () => {
    if (!party?.phone) { toast(t('noPhoneNumber'), 'error'); return; }
    await openWhatsApp(party.phone, `${settings.shopName || 'Mobilix'}: invoice ${sale.invoiceNo}, total ${Fmt.money(sale.total, settings.currency)}, paid ${Fmt.money(sale.paid, settings.currency)}, balance ${Fmt.money(Math.max(0, sale.due), settings.currency)}. Thank you!`, settings.countryCode);
  });

  return (
    <Screen back title={sale.invoiceNo} subtitle={Fmt.date(sale.date, lang)} right={<Badge tone={sale.kind === 'cash' ? 'teal' : sale.kind === 'credit' ? 'amber' : 'indigo'} label={t('kind_' + sale.kind)} />}>
      <Card>
        <T bold size={16}>{party?.name || t('walkIn')}</T>
        {party?.phone ? <Muted>{party.phone}</Muted> : null}
        {party ? <Button small variant="ghost" icon="person-outline" label={t('openLedger')} onPress={() => router.push(`/party/${party.id}`)} style={{ alignSelf: 'flex-start', marginTop: 10 }} /> : null}
      </Card>

      <Card flush>
        {items.map((i, k) => (
          <Row key={i.id} gap={10} align="flex-start" style={{ paddingVertical: 10, borderBottomWidth: k === items.length - 1 ? 0 : 0.5, borderBottomColor: C.line }}>
            <View style={{ flex: 1 }}><T bold size={14}>{i.label}</T>{i.sub ? <Muted>{i.sub}</Muted> : null}</View>
            <View style={{ alignItems: 'flex-end' }}><T bold num>{money(i.price * i.qty)}</T>{i.qty !== 1 ? <Muted>{i.qty} × {money(i.price)}</Muted> : null}</View>
          </Row>
        ))}
      </Card>

      <Card flush>
        {sale.discount ? <KV k={t('discount')} v={`-${money(sale.discount)}`} /> : null}
        {sale.markup ? <KV k={t('extraCharges')} v={money(sale.markup)} /> : null}
        <KV k={t('total')} v={money(sale.total)} />
        {sale.exchangeValue ? <KV k={`${t('tradeIn')}${d.exchangePhone ? ' · ' + d.exchangePhone.brand + ' ' + d.exchangePhone.model : ''}`} v={`-${money(sale.exchangeValue)}`} /> : null}
        <KV k={t('received')} v={money(sale.paid)} vColor={C.success} />
        <KV k={t('balanceDue')} v={money(Math.max(0, sale.due))} vColor={sale.due > 0.004 ? C.danger : C.success} />
      </Card>
      {sale.due > 0.004 ? (
        <Row gap={10}>
          <Button block icon="cash-outline" label={t('receivePayment')} onPress={openPay} />
          {party?.phone ? <Button block variant="ghost" icon="logo-whatsapp" label={t('remind')} onPress={remind} /> : null}
        </Row>
      ) : null}

      {plan ? (
        <>
          <SectionLabel>{t('installmentPlan')}</SectionLabel>
          <Card flush>
            {installments.map((i, k) => {
              const done = i.paid >= i.amount; const late = !done && i.dueDate < today;
              return (
                <Row key={i.id} gap={10} style={{ paddingVertical: 10, borderBottomWidth: k === installments.length - 1 ? 0 : 0.5, borderBottomColor: C.line }}>
                  <View style={{ flex: 1 }}><T bold size={14}>#{i.seq} · {Fmt.date(i.dueDate, lang, true)}</T>{i.paid > 0 && !done ? <Muted>{t('paid')} {money(i.paid)}</Muted> : null}</View>
                  <T bold num size={14}>{money(i.amount)}</T>
                  <Badge tone={done ? 'teal' : late ? 'red' : 'slate'} label={done ? t('paid') : late ? t('overdueShort') : t('upcoming')} />
                </Row>
              );
            })}
          </Card>
          {plan.guarantorName ? <Card flush><KV k={t('guarantor')} v={plan.guarantorName} />{plan.guarantorPhone ? <KV k={t('phone')} v={plan.guarantorPhone} /> : null}{plan.guarantorCnic ? <KV k={t('cnic')} v={plan.guarantorCnic} /> : null}</Card> : null}
        </>
      ) : null}

      {payments.length ? (
        <>
          <SectionLabel>{t('payments')}</SectionLabel>
          <Card flush>
            {payments.map((p) => <KV key={p.id} k={`${Fmt.date(p.date, lang, true)} · ${p.accountName}${p.note ? ' · ' + p.note : ''}`} v={money(p.amount)} />)}
          </Card>
        </>
      ) : null}

      {can('sales.documents') ? (<><SectionLabel>{t('documents')}</SectionLabel><Card><DocsSection ownerType="sale" ownerId={sale.id} /></Card></>) : null}

      {can('print.receipts') ? (
        <>
          <SectionLabel>{t('receipt')}</SectionLabel>
          <Chips value={paper} onChange={setPaper} items={[['a4', 'A4'], ['80', '80 mm'], ['58', '58 mm']]} />
          <Row gap={10}>
            <Button block icon="print-outline" label={t('print')} onPress={run(async () => printHtml(html(), paperVal))} />
            <Button block variant="ghost" icon="share-outline" label={t('sharePdf')} onPress={run(async () => shareHtmlPdf(html(), paperVal))} />
          </Row>
          {party?.phone ? <Button style={{ marginTop: 10 }} variant="ghost" icon="logo-whatsapp" label={t('sendWhatsApp')} onPress={sendReceipt} /> : null}
        </>
      ) : null}

      <Sheet visible={pay} onClose={() => setPay(false)} title={t('receivePayment')}>
        <NumField label={t('amount')} value={amount} onChangeText={setAmount} />
        <AccountPicker value={accountId} onChange={setAccountId} branchId={sale.branchId ?? branchId} />
        <Field label={t('date')} value={pdate} onChangeText={setPdate} ltr />
        <Button label={t('save')} onPress={doPay} disabled={!(Number(amount) > 0) || !accountId} />
      </Sheet>
      <Credit />
    </Screen>
  );
}
