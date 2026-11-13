import React, { useCallback, useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../ctx/AppContext';
import { Repo } from '../db/repo';
import type { Account, Doc, Party } from '../db/types';
import { C, R } from '../lib/theme';
import { deleteDocFiles, docUri, pickDocument, storeImage } from '../lib/files';
import { Button, Chips, Field, Muted, Row, SelectField, Sheet, T } from './kit';

// ---------------------------------------------------------------- Party picker (with quick add)
export function PartyPicker({ label, value, onChange, kind, optional }: { label: string; value: number | null; onChange: (id: number | null) => void; kind?: 'customer' | 'supplier'; optional?: boolean }) {
  const { t, toast } = useApp();
  const [list, setList] = useState<Party[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [cnic, setCnic] = useState('');
  const load = useCallback(async () => { setList(await Repo.listParties({ kind })); }, [kind]);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    try {
      const id = await Repo.saveParty({ kind: kind || 'customer', name, phone, cnic });
      await load(); onChange(id); setOpen(false); setName(''); setPhone(''); setCnic('');
    } catch (e: any) { toast(e.message, 'error'); }
  };
  const options = [
    ...(optional ? [{ value: '0', label: t('walkIn') }] : []),
    ...list.map((p) => ({ value: String(p.id), label: p.name, sub: p.phone })),
  ];
  return (
    <>
      <SelectField label={label} value={value ? String(value) : optional ? '0' : ''} options={options} searchable placeholder={t('select')}
        onChange={(v) => onChange(v === '0' ? null : Number(v))}
        footer={<View style={{ marginTop: 12 }}><Button variant="ghost" icon="person-add-outline" label={t('addNewParty')} onPress={() => setOpen(true)} /></View>} />
      <Sheet visible={open} onClose={() => setOpen(false)} title={t('addNewParty')}>
        <Field label={t('name')} value={name} onChangeText={setName} />
        <Field label={t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" ltr />
        <Field label={t('cnic')} value={cnic} onChangeText={setCnic} keyboardType="numbers-and-punctuation" ltr />
        <Button label={t('save')} onPress={add} disabled={!name.trim()} />
      </Sheet>
    </>
  );
}

// ---------------------------------------------------------------- Account picker
export function AccountPicker({ label, value, onChange, branchId }: { label?: string; value: number | null; onChange: (id: number) => void; branchId: number | null }) {
  const { t } = useApp();
  const [list, setList] = useState<Account[]>([]);
  const { money } = useApp();
  useEffect(() => { Repo.listAccounts(branchId).then((a) => { const act = a.filter((x) => x.isActive); setList(act); if (act.length && !act.some((x) => x.id === value)) onChange(act[0].id); }); }, [branchId]); // eslint-disable-line react-hooks/exhaustive-deps
  return <SelectField label={label || t('account')} value={value ? String(value) : ''} options={list.map((a) => ({ value: String(a.id), label: a.name, sub: money(a.balance) }))} onChange={(v) => onChange(Number(v))} />;
}

// ---------------------------------------------------------------- Documents
export interface PendingDoc { label: string; file: string }
const LABELS = ['cnicFront', 'cnicBack', 'agreement', 'otherDoc'] as const;

function AddDocSheet({ visible, onClose, onPicked }: { visible: boolean; onClose: () => void; onPicked: (docs: PendingDoc[]) => void }) {
  const { t, toast } = useApp();
  const [label, setLabel] = useState<(typeof LABELS)[number]>('cnicFront');
  const [busy, setBusy] = useState(false);
  const go = async (source: 'camera' | 'gallery') => {
    setBusy(true);
    try {
      const uris = await pickDocument(source);
      const out: PendingDoc[] = [];
      for (const u of uris) out.push({ label: t(label), file: await storeImage(u) });
      if (out.length) { onPicked(out); onClose(); }
    } catch (e: any) { toast(e.message === 'cameraPermission' ? t('cameraDenied') : e.message, 'error'); }
    setBusy(false);
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t('addDocument')}>
      <Chips value={label} onChange={setLabel} items={LABELS.map((l) => [l, t(l)] as [typeof label, string])} />
      <Row gap={10}>
        <Button block icon="camera-outline" label={t('camera')} onPress={() => go('camera')} loading={busy} />
        <Button block variant="ghost" icon="images-outline" label={t('gallery')} onPress={() => go('gallery')} disabled={busy} />
      </Row>
    </Sheet>
  );
}

function Thumbs({ docs, onRemove, readOnly }: { docs: (PendingDoc & { key: string })[]; onRemove?: (key: string) => void; readOnly?: boolean }) {
  const [view, setView] = useState<string | null>(null);
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
        {docs.map((d) => (
          <View key={d.key} style={{ width: 92 }}>
            <Pressable onPress={() => setView(d.file)}><Image source={{ uri: docUri(d.file) }} style={{ width: 92, height: 92, borderRadius: R.md, backgroundColor: C.subtle }} /></Pressable>
            <Muted numberOfLines={1} style={{ marginTop: 4 }}>{d.label}</Muted>
            {!readOnly && onRemove ? <Pressable onPress={() => onRemove(d.key)} hitSlop={8} style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(15,23,42,0.7)', borderRadius: 10, padding: 2 }}><Ionicons name="close" size={14} color="#fff" /></Pressable> : null}
          </View>
        ))}
      </ScrollView>
      <Modal visible={!!view} transparent animationType="fade" onRequestClose={() => setView(null)}>
        <Pressable onPress={() => setView(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' }}>
          {view ? <Image source={{ uri: docUri(view) }} resizeMode="contain" style={{ width: '100%', height: '85%' }} /> : null}
        </Pressable>
      </Modal>
    </>
  );
}

/** For a form that is not saved yet: the photos are kept in the parent's state and written with the record. */
export function PendingDocs({ value, onChange }: { value: PendingDoc[]; onChange: (v: PendingDoc[]) => void }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <View>
      {value.length ? <Thumbs docs={value.map((d) => ({ ...d, key: d.file }))} onRemove={(k) => { deleteDocFiles([k]); onChange(value.filter((d) => d.file !== k)); }} /> : <Muted>{t('noDocuments')}</Muted>}
      <View style={{ height: 8 }} />
      <Button small variant="ghost" icon="attach-outline" label={t('addDocument')} onPress={() => setOpen(true)} />
      <AddDocSheet visible={open} onClose={() => setOpen(false)} onPicked={(d) => onChange([...value, ...d])} />
    </View>
  );
}
export async function savePendingDocs(ownerType: Doc['ownerType'], ownerId: number, docs: PendingDoc[]) {
  for (const d of docs) await Repo.addDocument(ownerType, ownerId, d.label, d.file);
}

/** For a record that already exists: documents are loaded from and saved to the database. */
export function DocsSection({ ownerType, ownerId }: { ownerType: Doc['ownerType']; ownerId: number }) {
  const { t, confirm } = useApp();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => setDocs(await Repo.listDocuments(ownerType, ownerId)), [ownerType, ownerId]);
  useEffect(() => { load(); }, [load]);
  return (
    <View>
      {docs.length ? <Thumbs docs={docs.map((d) => ({ label: d.label, file: d.file, key: String(d.id) }))}
        onRemove={async (k) => { if (await confirm(t('deleteDocMsg'), { danger: true, okLabel: t('delete') })) { const f = await Repo.deleteDocument(Number(k)); if (f) deleteDocFiles([f]); load(); } }} /> : <Muted>{t('noDocuments')}</Muted>}
      <View style={{ height: 8 }} />
      <Button small variant="ghost" icon="attach-outline" label={t('addDocument')} onPress={() => setOpen(true)} />
      <AddDocSheet visible={open} onClose={() => setOpen(false)} onPicked={async (d) => { await savePendingDocs(ownerType, ownerId, d); load(); }} />
    </View>
  );
}
