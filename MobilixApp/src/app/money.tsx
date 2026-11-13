import React, { useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../ctx/AppContext';
import { Repo } from '../db/repo';
import { EXPENSE_CATEGORIES, type AccountType } from '../db/types';
import { Fmt } from '../lib/format';
import { monthBounds, todayStr } from '../lib/dates';
import { useLoad } from '../lib/hooks';
import { C } from '../lib/theme';
import { useCan } from '../license/LicenseGate';
import { Button, Card, Chips, Credit, Field, IconButton, KV, ListItem, Muted, NumField, Row, Screen, SectionLabel, Segmented, SelectField, Sheet, T } from '../ui/kit';
import { AccountPicker } from '../ui/pickers';

/** Cash / bank / wallet accounts, transfers between them, and shop expenses. */
export default function Money() {
  const { t, money, viewBranch, branchId, toast, confirm, lang } = useApp();
  const can = useCan();
  const { from, to } = monthBounds();
  const [accounts, reloadA] = useLoad(() => Repo.listAccounts(viewBranch), [viewBranch]);
  const [expenses, reloadE] = useLoad(() => Repo.listExpenses({ from, to, branchId: viewBranch }), [viewBranch]);
  const [sheet, setSheet] = useState<null | 'account' | 'transfer' | 'expense'>(null);
  const [name, setName] = useState(''); const [type, setType] = useState<AccountType>('bank'); const [opening, setOpening] = useState('');
  const [fromAcc, setFromAcc] = useState<number | null>(null); const [toAcc, setToAcc] = useState<number | null>(null); const [amount, setAmount] = useState('');
  const [cat, setCat] = useState<string>('rent'); const [acc, setAcc] = useState<number | null>(null); const [note, setNote] = useState(''); const [date, setDate] = useState(todayStr());
  const reload = async () => { await reloadA(); await reloadE(); };
  const close = () => { setSheet(null); setName(''); setOpening(''); setAmount(''); setNote(''); };
  const run = (fn: () => Promise<void>) => async () => { try { await fn(); close(); await reload(); toast(t('saved'), 'success'); } catch (e: any) { toast(e.message, 'error'); } };
  const total = (accounts || []).filter((a) => a.isActive).reduce((s, a) => s + a.balance, 0);
  const spent = (expenses || []).reduce((s, e) => s + e.amount, 0);
  const accOptions = (accounts || []).map((a) => ({ value: String(a.id), label: a.name, sub: money(a.balance) }));

  return (
    <Screen back title={t('moneyTitle')} onRefresh={reload}>
      <SectionLabel right={<Button small variant="ghost" icon="add" label={t('addAccount')} onPress={() => setSheet('account')} />}>{t('accounts')}</SectionLabel>
      <Card flush>
        {(accounts || []).map((a) => <KV key={a.id} k={`${a.name} · ${t('acc_' + a.type)}`} v={money(a.balance)} vColor={a.balance < 0 ? C.danger : undefined} />)}
        <KV k={t('total')} v={money(total)} />
      </Card>
      {(accounts || []).length > 1 ? <Button variant="ghost" icon="swap-horizontal-outline" label={t('transferMoney')} onPress={() => { setFromAcc(null); setToAcc(null); setSheet('transfer'); }} /> : null}

      {can('accounts.expenses') ? (
        <>
          <SectionLabel right={<Button small variant="ghost" icon="add" label={t('addExpense')} onPress={() => setSheet('expense')} />}>{t('expensesThisMonth')}</SectionLabel>
          <Card style={{ alignItems: 'center' }}><Muted>{t('totalExpenses')}</Muted><T bold size={24} num>{money(spent)}</T></Card>
          {(expenses || []).length ? (
            <Card flush>
              {(expenses || []).map((e, i) => (
                <ListItem key={e.id} last={i === (expenses || []).length - 1} title={t('cat_' + e.category)} sub={`${Fmt.date(e.date, lang, true)} · ${e.accountName}${e.note ? ' · ' + e.note : ''}`}
                  trail={<Row gap={4}><T bold num>{money(e.amount)}</T><IconButton icon="trash-outline" color={C.danger} onPress={async () => { if (await confirm(t('deleteExpenseMsg'), { danger: true, okLabel: t('delete') })) { await Repo.deleteExpense(e.id); reload(); } }} /></Row>} />
              ))}
            </Card>
          ) : <Muted>{t('noExpenses')}</Muted>}
        </>
      ) : null}

      <Sheet visible={sheet === 'account'} onClose={close} title={t('addAccount')}>
        <Field label={t('name')} value={name} onChangeText={setName} />
        <Segmented value={type} onChange={setType} items={[['cash', t('acc_cash')], ['bank', t('acc_bank')], ['wallet', t('acc_wallet')]]} />
        <NumField label={t('openingBalance')} value={opening} onChangeText={setOpening} style={{ marginTop: 14 }} />
        <Button label={t('save')} disabled={!name.trim()} onPress={run(async () => { await Repo.addAccount(branchId, name, type, Number(opening) || 0); })} />
      </Sheet>
      <Sheet visible={sheet === 'transfer'} onClose={close} title={t('transferMoney')}>
        <SelectField label={t('fromAccount')} value={fromAcc ? String(fromAcc) : ''} options={accOptions} onChange={(v) => setFromAcc(Number(v))} />
        <SelectField label={t('toAccount')} value={toAcc ? String(toAcc) : ''} options={accOptions} onChange={(v) => setToAcc(Number(v))} />
        <NumField label={t('amount')} value={amount} onChangeText={setAmount} />
        <Button label={t('save')} disabled={!fromAcc || !toAcc || !(Number(amount) > 0)} onPress={run(async () => { await Repo.addTransfer(fromAcc!, toAcc!, Number(amount), todayStr()); })} />
      </Sheet>
      <Sheet visible={sheet === 'expense'} onClose={close} title={t('addExpense')}>
        <Chips value={cat as any} onChange={setCat} items={EXPENSE_CATEGORIES.map((c) => [c, t('cat_' + c)] as [string, string])} />
        <NumField label={t('amount')} value={amount} onChangeText={setAmount} />
        <AccountPicker value={acc} onChange={setAcc} branchId={viewBranch} />
        <Field label={t('date')} value={date} onChangeText={setDate} ltr />
        <Field label={t('notes')} value={note} onChangeText={setNote} />
        <Button label={t('save')} disabled={!acc || !(Number(amount) > 0)} onPress={run(async () => { await Repo.addExpense({ branchId, accountId: acc!, date, category: cat, amount: Number(amount), note }); })} />
      </Sheet>
      <Credit />
    </Screen>
  );
}
