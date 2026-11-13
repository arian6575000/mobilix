import React from 'react';
import { View } from 'react-native';
import { useApp } from '../ctx/AppContext';
import type { PhoneDraft } from '../db/types';
import { Button, Chips, Field, NumField, Row, Segmented, T } from './kit';
import { useScanner } from './Scanner';

export interface DraftState {
  brand: string; model: string; storage: string; ram: string; color: string; condition: 'new' | 'used'; grade: string;
  pta: 'approved' | 'non_pta' | 'unknown'; battery: string; imei1: string; imei2: string; cost: string; price: string; notes: string;
}
export const emptyDraft = (): DraftState => ({ brand: '', model: '', storage: '', ram: '', color: '', condition: 'new', grade: '', pta: 'unknown', battery: '', imei1: '', imei2: '', cost: '', price: '', notes: '' });

export function toDraft(s: DraftState): PhoneDraft {
  const cost = Number(s.cost); const price = Number(s.price);
  if (!(cost >= 0) || s.cost.trim() === '') throw new Error('Enter the cost price');
  if (!(price >= 0) || s.price.trim() === '') throw new Error('Enter the selling price');
  const battery = s.battery.trim() ? Number(s.battery) : null;
  if (battery !== null && !(battery >= 0 && battery <= 100)) throw new Error('Battery health must be between 0 and 100');
  return { brand: s.brand, model: s.model, storage: s.storage, ram: s.ram, color: s.color.trim(), condition: s.condition, grade: s.condition === 'used' ? s.grade : '',
    pta: s.pta, battery: s.condition === 'used' ? battery : null, imei1: s.imei1.trim(), imei2: s.imei2.trim(), cost, price, notes: s.notes.trim() };
}

const BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'Redmi', 'Oppo', 'Vivo', 'Realme', 'Infinix', 'Tecno', 'Itel', 'Huawei', 'Honor', 'Google', 'OnePlus', 'Nokia', 'Motorola'];
const STORAGE = ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'];
const RAM = ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB'];

export function PhoneForm({ value, onChange, hideCost }: { value: DraftState; onChange: (v: DraftState) => void; hideCost?: boolean }) {
  const { t, toast } = useApp();
  const [scanEl, scan] = useScanner();
  const set = (k: keyof DraftState) => (v: string) => onChange({ ...value, [k]: v });
  const scanInto = async (k: 'imei1' | 'imei2') => {
    const code = await scan();
    if (!code) return;
    const digits = code.replace(/\D/g, '');
    if (digits.length !== 15) { toast(t('notAnImei'), 'error'); return; }
    onChange({ ...value, [k]: digits });
  };
  return (
    <View>
      <Segmented value={value.condition} onChange={(c) => onChange({ ...value, condition: c })} items={[['new', t('condNew')], ['used', t('condUsed')]]} />
      <View style={{ height: 14 }} />
      <Chips value={value.brand as any} onChange={(b) => set('brand')(b)} items={BRANDS.map((b) => [b, b] as [string, string])} />
      <Field label={t('brand')} value={value.brand} onChangeText={set('brand')} autoCapitalize="words" />
      <Field label={t('model')} value={value.model} onChangeText={set('model')} autoCapitalize="words" />
      <Chips value={value.storage as any} onChange={set('storage')} items={STORAGE.map((b) => [b, b] as [string, string])} />
      <Field label={t('storage')} value={value.storage} onChangeText={set('storage')} />
      <Chips value={value.ram as any} onChange={set('ram')} items={RAM.map((b) => [b, b] as [string, string])} />
      <Field label={t('ram')} value={value.ram} onChangeText={set('ram')} />
      <Field label={t('color')} value={value.color} onChangeText={set('color')} />
      <Field label={t('imei1')} value={value.imei1} onChangeText={(v) => set('imei1')(v.replace(/\D/g, '').slice(0, 15))} keyboardType="number-pad" ltr maxLength={15} />
      <Button small variant="ghost" icon="barcode-outline" label={t('scanImei')} onPress={() => scanInto('imei1')} style={{ alignSelf: 'flex-start', marginTop: -6, marginBottom: 14 }} />
      <Field label={t('imei2')} value={value.imei2} onChangeText={(v) => set('imei2')(v.replace(/\D/g, '').slice(0, 15))} keyboardType="number-pad" ltr maxLength={15} />
      <T_Label text={t('ptaStatus')} />
      <Segmented value={value.pta} onChange={(p) => onChange({ ...value, pta: p })} items={[['approved', t('ptaApproved')], ['non_pta', t('ptaNon')], ['unknown', t('ptaUnknown')]]} />
      <View style={{ height: 14 }} />
      {value.condition === 'used' ? (
        <>
          <T_Label text={t('grade')} />
          <Segmented value={(value.grade || 'A') as any} onChange={set('grade')} items={[['A', 'A'], ['B', 'B'], ['C', 'C']]} />
          <View style={{ height: 14 }} />
          <NumField label={t('batteryHealth')} value={value.battery} onChangeText={set('battery')} placeholder="%" />
        </>
      ) : null}
      <Row gap={10} align="flex-start">
        {hideCost ? null : <View style={{ flex: 1 }}><NumField label={t('costPrice')} value={value.cost} onChangeText={set('cost')} /></View>}
        <View style={{ flex: 1 }}><NumField label={t('sellPrice')} value={value.price} onChangeText={set('price')} /></View>
      </Row>
      <Field label={t('notes')} value={value.notes} onChangeText={set('notes')} multiline />
      {scanEl}
    </View>
  );
}
const T_Label = ({ text }: { text: string }) => <T size={12.5} bold color="#475569" style={{ marginBottom: 6 }}>{text}</T>;
