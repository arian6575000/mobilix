import React, { useState } from 'react';
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { useApp } from '../ctx/AppContext';
import { Repo } from '../db/repo';
import { decryptBackup, encryptBackup, isEncryptedBackup } from '../lib/backupCrypto';
import { readDocBase64, writeDocBase64 } from '../lib/files';
import { C } from '../lib/theme';
import { Button, Card, Credit, Field, Muted, Screen, SectionLabel, Sheet, T } from '../ui/kit';

export default function Backup() {
  const { t, toast, confirm, reloadSettings } = useApp();
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [askPass, setAskPass] = useState<null | any>(null);
  const [importPass, setImportPass] = useState('');

  const doExport = async () => {
    setBusy(true);
    try {
      const data: any = await Repo.exportAll();
      const files: Record<string, string> = {};
      for (const name of await Repo.allDocumentFiles()) { const b = await readDocBase64(name); if (b) files[name] = b; }
      data.files = files;
      let text = JSON.stringify(data);
      if (pass.trim()) text = encryptBackup(text, pass.trim());
      const d = new Date();
      const file = new File(Paths.cache, `mobilix-backup-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(text);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Mobilix backup' });
      toast(t('backupReady'), 'success');
    } catch (e: any) { toast(e.message, 'error'); }
    setBusy(false);
  };

  const restore = async (payload: any) => {
    if (!(await confirm(t('restoreWarn'), { danger: true, okLabel: t('restore') }))) return;
    setBusy(true);
    try {
      await Repo.importAll(payload);
      for (const [name, b64] of Object.entries<string>(payload.files || {})) await writeDocBase64(name, b64);
      await reloadSettings();
      toast(t('restored'), 'success');
    } catch (e: any) { toast(e.message, 'error'); }
    setBusy(false);
  };

  const doImport = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const parsed = JSON.parse(await new File(res.assets[0].uri).text());
      if (isEncryptedBackup(parsed)) { setImportPass(''); setAskPass(parsed); return; }
      await restore(parsed);
    } catch (e: any) { toast(e.message?.includes('JSON') ? t('notBackup') : e.message, 'error'); }
  };
  const unlock = async () => {
    try { const payload = decryptBackup(askPass, importPass); setAskPass(null); await restore(payload); }
    catch { toast(t('wrongBackupPassword'), 'error'); }
  };

  return (
    <Screen back title={t('backupTitle')}>
      <SectionLabel>{t('exportBackup')}</SectionLabel>
      <Card>
        <Muted style={{ marginBottom: 12 }}>{t('backupHint')}</Muted>
        <Field label={t('backupPassword')} value={pass} onChangeText={setPass} secureTextEntry autoCapitalize="none" hint={t('backupPasswordHint')} />
        <Button icon="cloud-upload-outline" label={t('exportBackup')} onPress={doExport} loading={busy} />
      </Card>
      <SectionLabel>{t('restoreBackup')}</SectionLabel>
      <Card>
        <T size={13.5} color={C.soft} style={{ marginBottom: 12 }}>{t('restoreHint')}</T>
        <Button variant="danger" icon="cloud-download-outline" label={t('restoreBackup')} onPress={doImport} disabled={busy} />
      </Card>
      <Sheet visible={!!askPass} onClose={() => setAskPass(null)} title={t('backupPassword')}>
        <Field label={t('backupPassword')} value={importPass} onChangeText={setImportPass} secureTextEntry autoCapitalize="none" />
        <Button label={t('restore')} onPress={unlock} disabled={!importPass} />
      </Sheet>
      <Credit />
    </Screen>
  );
}
