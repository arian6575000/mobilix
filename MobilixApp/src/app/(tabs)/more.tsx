import React, { useCallback, useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { useApp } from '../../ctx/AppContext';
import { CURRENCIES } from '../../db/types';
import { Repo } from '../../db/repo';
import { useLoad } from '../../lib/hooks';
import { biometricAvailable, biometricEnabled, checkPin, hasPin, removePin, setBiometric, setPin } from '../../lib/lock';
import { C } from '../../lib/theme';
import { useCan, useLicense } from '../../license/LicenseGate';
import { getDeviceId } from '../../license/deviceId';
import { router } from 'expo-router';
import { Avatar, Button, Card, Credit, Field, KV, ListItem, Row, Screen, SectionLabel, Segmented, SelectField, T } from '../../ui/kit';
import { usePinPrompt } from '../../ui/PinPrompt';
import { APP_NAME } from '../../lib/brand';
import Constants from 'expo-constants';

export default function More() {
  const { t, settings, saveSettings, setLang, toast, confirm, reloadSettings, lang } = useApp();
  const can = useCan();
  const lic = useLicense();
  const [pinEl, askPin] = usePinPrompt();
  const [branches, reloadBranches] = useLoad(() => Repo.listBranches(), []);
  const [pinOn, setPinOn] = useState(false);
  const [bioOn, setBioOn] = useState(false);
  const [bioAvail, setBioAvail] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [shop, setShop] = useState(settings.shopName);
  const [owner, setOwner] = useState(settings.ownerName);

  const refreshLock = useCallback(async () => {
    setPinOn(await hasPin()); setBioOn(await biometricEnabled()); setBioAvail(await biometricAvailable());
  }, []);
  useEffect(() => { refreshLock(); getDeviceId().then(setDeviceId).catch(() => {}); }, [refreshLock]);
  useEffect(() => { setShop(settings.shopName); setOwner(settings.ownerName); }, [settings.shopName, settings.ownerName]);

  const saveShop = async () => { await saveSettings({ ...settings, shopName: shop.trim(), ownerName: owner.trim() }); toast(t('saved'), 'success'); };

  const enablePin = async () => {
    const a = await askPin(t('newPin')); if (!a) return;
    const b = await askPin(t('confirmPin')); if (!b) return;
    if (a !== b) { toast(t('pinMismatch'), 'error'); return; }
    await setPin(a); await refreshLock(); toast(t('pinSet'), 'success');
  };
  const changePin = async () => {
    const cur = await askPin(t('enterCurrentPin')); if (!cur) return;
    if (!(await checkPin(cur)).ok) { toast(t('wrongPin'), 'error'); return; }
    await enablePin();
  };
  const disablePin = async () => {
    const cur = await askPin(t('enterCurrentPin')); if (!cur) return;
    if (!(await checkPin(cur)).ok) { toast(t('wrongPin'), 'error'); return; }
    await removePin(); await setBiometric(false); await refreshLock(); toast(t('pinRemoved'), 'success');
  };

  const multi = can('branches.multi');
  const addBranch = async () => {
    if (!newBranch.trim()) return;
    if (!multi) { toast(t('branchNeedsLicense'), 'error'); return; }
    await Repo.addBranch(newBranch); setNewBranch(''); await reloadBranches(); toast(t('saved'), 'success');
  };

  const erase = async () => {
    if (!(await confirm(t('eraseMsg'), { danger: true, okLabel: t('eraseEverything') }))) return;
    await Repo.wipeAll(); await removePin(); await setBiometric(false); await reloadSettings(); await refreshLock(); toast(t('erased'), 'success');
  };

  return (
    <Screen title={t('moreTitle')}>
      <Card flush>
        <ListItem left={<Avatar icon="people-outline" />} title={t('parties')} sub={t('partiesHint')} onPress={() => router.push('/party')} trail={<T color={C.faint}>›</T>} />
        <ListItem left={<Avatar icon="download-outline" />} title={t('purchasesTitle')} sub={t('purchasesHint')} onPress={() => router.push('/purchases')} trail={<T color={C.faint}>›</T>} />
        <ListItem left={<Avatar icon="wallet-outline" />} title={t('moneyTitle')} sub={t('moneyHint')} onPress={() => router.push('/money')} trail={<T color={C.faint}>›</T>} />
        {can('accounts.reports') ? <ListItem left={<Avatar icon="bar-chart-outline" />} title={t('reportsTitle')} sub={t('reportsHint')} onPress={() => router.push('/reports')} trail={<T color={C.faint}>›</T>} /> : null}
        {can('backup.export') ? <ListItem last left={<Avatar icon="cloud-upload-outline" />} title={t('backupTitle')} sub={t('backupMenuHint')} onPress={() => router.push('/backup')} trail={<T color={C.faint}>›</T>} /> : null}
      </Card>

      <SectionLabel>{t('preferences')}</SectionLabel>
      <Card>
        <T size={12.5} bold color={C.soft} style={{ marginBottom: 6 }}>{t('language')}</T>
        <Segmented value={lang} onChange={(l) => setLang(l)} items={[['en', t('english')], ['ur', t('urdu')]]} />
        <View style={{ height: 14 }} />
        <SelectField label={t('currency')} value={settings.currency.code} options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} (${c.symbol})` }))}
          onChange={(code) => saveSettings({ ...settings, currency: CURRENCIES.find((c) => c.code === code) || CURRENCIES[0] })} />
        <T size={12.5} color={C.faint}>{t('currencyHint')}</T>
      </Card>

      <SectionLabel>{t('shop')}</SectionLabel>
      <Card>
        <Field label={t('shopName')} value={shop} onChangeText={setShop} />
        <Field label={t('ownerName')} value={owner} onChangeText={setOwner} />
        <Button label={t('save')} onPress={saveShop} disabled={shop.trim() === settings.shopName && owner.trim() === settings.ownerName} />
      </Card>

      <SectionLabel>{t('branch')}</SectionLabel>
      <Card>
        {multi && branches && branches.length > 1 ? (
          <SelectField label={t('activeBranch')} value={settings.activeBranchId === null ? 'all' : String(settings.activeBranchId)}
            options={[{ value: 'all', label: t('allBranches') }, ...branches.map((b) => ({ value: String(b.id), label: b.name }))]}
            onChange={(v) => saveSettings({ ...settings, activeBranchId: v === 'all' ? null : Number(v) })} />
        ) : null}
        {(branches || []).map((b) => <KV key={b.id} k={b.name} v={b.isDefault ? '•' : ''} />)}
        <View style={{ height: 12 }} />
        <Field label={t('branchName')} value={newBranch} onChangeText={setNewBranch} />
        <Button variant="ghost" icon="add" label={t('addBranch')} onPress={addBranch} disabled={!newBranch.trim()} />
      </Card>

      <SectionLabel>{t('security')}</SectionLabel>
      <Card>
        <KV k={t('pinLock')} v={pinOn ? t('pinOn') : t('pinOff')} vColor={pinOn ? C.success : C.faint} />
        <View style={{ height: 12 }} />
        {pinOn ? (
          <Row gap={10}>
            <Button block variant="ghost" label={t('changePin')} onPress={changePin} />
            <Button block variant="danger" label={t('removePin')} onPress={disablePin} />
          </Row>
        ) : <Button icon="lock-closed-outline" label={t('setPin')} onPress={enablePin} />}
        {pinOn && bioAvail ? (
          <Row style={{ justifyContent: 'space-between', marginTop: 14 }}>
            <T size={14} bold>{t('biometric')}</T>
            <Switch value={bioOn} onValueChange={async (v) => { await setBiometric(v); setBioOn(v); }} trackColor={{ true: C.primary, false: C.line }} />
          </Row>
        ) : null}
      </Card>

      <SectionLabel>{t('license')}</SectionLabel>
      <Card flush>
        <KV k={t('licensedTo')} v={lic?.payload.client_name || '—'} />
        <KV k={t('plan')} v={lic?.payload.plan_name || '—'} />
        <KV k={t('expires')} v={lic ? (lic.daysLeft === null ? t('lifetime') : `${lic.payload.expiry_date} · ${t('daysLeft').replace('{n}', String(lic.daysLeft))}`) : '—'} />
        <KV k={t('deviceId')} v={deviceId || '…'} />
      </Card>

      <SectionLabel>{t('about')}</SectionLabel>
      <Card flush>
        <KV k={APP_NAME} v={`${t('version')} ${Constants.expoConfig?.version ?? ''}`} />
      </Card>

      <SectionLabel>{t('dangerZone')}</SectionLabel>
      <Button variant="danger" icon="trash-outline" label={t('eraseAll')} onPress={erase} />

      <Credit />
      {pinEl}
    </Screen>
  );
}
