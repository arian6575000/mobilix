import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import type { PartyKind } from '../../db/types';
import { Button, Card, Field, Screen, Segmented } from '../../ui/kit';

export default function PartyForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t, toast, confirm } = useApp();
  const [f, setF] = useState({ kind: 'customer' as PartyKind, name: '', phone: '', cnic: '', address: '', notes: '' });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  useEffect(() => { if (id) Repo.getParty(Number(id)).then((p) => p && setF({ kind: p.kind, name: p.name, phone: p.phone, cnic: p.cnic, address: p.address, notes: p.notes })); }, [id]);
  const save = async () => { try { const pid = await Repo.saveParty(f, id ? Number(id) : undefined); toast(t('saved'), 'success'); if (id) router.back(); else router.replace(`/party/${pid}`); } catch (e: any) { toast(e.message, 'error'); } };
  const del = async () => { if (!(await confirm(t('deletePartyMsg'), { danger: true, okLabel: t('delete') }))) return; try { await Repo.deleteParty(Number(id)); router.dismissAll?.(); router.replace('/party'); } catch (e: any) { toast(e.message, 'error'); } };
  return (
    <Screen back title={id ? t('editParty') : t('newParty')}>
      <Card>
        <Segmented value={f.kind} onChange={(k) => setF((s) => ({ ...s, kind: k }))} items={[['customer', t('customer')], ['supplier', t('supplier')], ['both', t('both')]]} />
        <Field label={t('name')} value={f.name} onChangeText={set('name')} autoCapitalize="words" style={{ marginTop: 14 }} />
        <Field label={t('phone')} value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" ltr />
        <Field label={t('cnic')} value={f.cnic} onChangeText={set('cnic')} ltr />
        <Field label={t('address')} value={f.address} onChangeText={set('address')} />
        <Field label={t('notes')} value={f.notes} onChangeText={set('notes')} multiline />
        <Button label={t('save')} onPress={save} disabled={!f.name.trim()} />
      </Card>
      {id ? <Button variant="danger" icon="trash-outline" label={t('delete')} onPress={del} /> : null}
    </Screen>
  );
}
