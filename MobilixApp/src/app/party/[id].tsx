import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import { Fmt } from '../../lib/format';
import { todayStr } from '../../lib/dates';
import { useLoad } from '../../lib/hooks';
import { printHtml, shareHtmlPdf, statementHtml } from '../../lib/receipt';
import { openWhatsApp } from '../../lib/whatsapp';
import { C } from '../../lib/theme';
import { Button, Card, Credit, Field, IconButton, Loading, Muted, NumField, Row, Screen, SectionLabel, Sheet, T } from '../../ui/kit';
import { AccountPicker, DocsSection } from '../../ui/pickers';

export default function PartyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, money, settings, toast, branchId, lang } = useApp();
  const [p, reloadP] = useLoad(() => Repo.getParty(Number(id)), [id]);
  const [ledger, reloadL] = useLoad(() => Repo.partyLedger(Number(id)), [id]);
  const [dir, setDir] = useState<'in' | 'out' | null>(null);
  const [amount, setAmount] = useState(''); const [accountId, setAccountId] = useState<number | null>(null); const [date, setDate] = useState(todayStr()); const [note, setNote] = useState('');
  if (!p) return <Screen back title=" "><Loading /></Screen>;

  const open = (d: 'in' | 'out') => { setDir(d); setAmount(String(Math.abs(p.balance) > 0.004 && ((d === 'in') === (p.balance > 0)) ? Math.abs(p.balance) : '')); setDate(todayStr()); setNote(''); };
  const save = async () => {
    try { await Repo.partyPayment({ partyId: p.id, direction: dir!, amount: Number(amount), accountId: accountId!, date, note }); setDir(null); await reloadP(); await reloadL(); toast(t('saved'), 'success'); }
    catch (e: any) { toast(e.message, 'error'); }
  };
  const stmt = () => statementHtml(p, ledger || [], settings);
  const run = (fn: () => Promise<void>) => async () => { try { await fn(); } catch (e: any) { toast(e.message, 'error'); } };

  return (
    <Screen back title={p.name} subtitle={p.phone || undefined} right={<IconButton icon="create-outline" onPress={() => router.push({ pathname: '/party/form', params: { id: String(p.id) } })} />}>
      <Card style={{ alignItems: 'center' }}>
        <Muted>{Math.abs(p.balance) < 0.005 ? t('settled') : p.balance > 0 ? t('theyOwe') : t('youOweThem')}</Muted>
        <T bold size={30} num color={p.balance > 0.004 ? C.danger : p.balance < -0.004 ? C.success : C.ink}>{money(Math.abs(p.balance))}</T>
      </Card>
      <Row gap={10}>
        <Button block icon="arrow-down-outline" label={t('receive')} onPress={() => open('in')} />
        <Button block variant="ghost" icon="arrow-up-outline" label={t('pay')} onPress={() => open('out')} />
      </Row>
      <View style={{ height: 10 }} />
      <Row gap={10}>
        <Button block variant="ghost" icon="print-outline" label={t('statement')} onPress={run(async () => printHtml(stmt(), 'a4'))} />
        <Button block variant="ghost" icon="share-outline" label={t('sharePdf')} onPress={run(async () => shareHtmlPdf(stmt(), 'a4'))} />
        {p.phone && p.balance > 0.004 ? <Button block variant="ghost" icon="logo-whatsapp" label={t('remind')} onPress={run(async () => openWhatsApp(p.phone, `Assalam o Alaikum ${p.name}, your balance with ${settings.shopName || 'us'} is ${Fmt.money(p.balance, settings.currency)}. Please clear it at your earliest. Thank you.`, settings.countryCode))} /> : null}
      </Row>

      <SectionLabel>{t('ledger')}</SectionLabel>
      {!ledger ? <Loading /> : !ledger.length ? <Muted>{t('noTransactions')}</Muted> : (
        <Card flush>
          {[...ledger].reverse().map((e, i) => (
            <Row key={`${e.type}${e.refId}${i}`} gap={10} style={{ paddingVertical: 10, borderBottomWidth: i === ledger.length - 1 ? 0 : 0.5, borderBottomColor: C.line }}
              >
              <View style={{ flex: 1 }}>
                <T bold size={14} numberOfLines={1}>{e.label}</T>
                <Muted>{Fmt.date(e.date, lang, true)}</Muted>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T bold size={14} num color={e.debit ? C.danger : C.success}>{e.debit ? '+' : '-'}{money(e.debit || e.credit)}</T>
                <Muted>{money(e.balance)}</Muted>
              </View>
            </Row>
          ))}
        </Card>
      )}

      <SectionLabel>{t('documents')}</SectionLabel>
      <Card><DocsSection ownerType="party" ownerId={p.id} /></Card>

      <Sheet visible={!!dir} onClose={() => setDir(null)} title={dir === 'in' ? t('receive') : t('pay')}>
        <NumField label={t('amount')} value={amount} onChangeText={setAmount} />
        <AccountPicker value={accountId} onChange={setAccountId} branchId={branchId} />
        <Field label={t('date')} value={date} onChangeText={setDate} ltr />
        <Field label={t('notes')} value={note} onChangeText={setNote} />
        <Muted style={{ marginBottom: 12 }}>{t('paymentAllocHint')}</Muted>
        <Button label={t('save')} onPress={save} disabled={!(Number(amount) > 0) || !accountId} />
      </Sheet>
      <Credit />
    </Screen>
  );
}
