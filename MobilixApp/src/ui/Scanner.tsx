import React, { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../ctx/AppContext';
import { C } from '../lib/theme';
import { Button, Muted, T } from './kit';

const TYPES = ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_a', 'datamatrix'] as const;

/** Live camera that reports each new code once. Use inside a screen (Scan tab) or inside useScanner's modal. */
export function ScannerView({ onScan, paused }: { onScan: (code: string) => void; paused?: boolean }) {
  const { t } = useApp();
  const [perm, ask] = useCameraPermissions();
  const last = useRef({ code: '', at: 0 });
  if (!perm) return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  if (!perm.granted) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.bg }}>
        <Ionicons name="camera-outline" size={40} color={C.faint} />
        <T center style={{ marginVertical: 12 }}>{t('cameraNeeded')}</T>
        <Button label={t('allowCamera')} onPress={ask} />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: [...TYPES] }}
        onBarcodeScanned={paused ? undefined : ({ data }) => {
          const now = Date.now();
          if (data === last.current.code && now - last.current.at < 2500) return; // same code held in front of the camera
          last.current = { code: data, at: now };
          onScan(data);
        }} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <View style={{ width: 240, height: 240, borderRadius: 24, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' }} />
        <Muted color="#fff" style={{ marginTop: 14 }}>{t('pointCamera')}</Muted>
      </View>
    </View>
  );
}

/** const [el, scan] = useScanner();  const code = await scan();  (null when closed)  — render {el} once in the screen. */
export function useScanner(): [React.ReactElement, () => Promise<string | null>] {
  const [open, setOpen] = useState(false);
  const resolver = useRef<((v: string | null) => void) | null>(null);
  const finish = useCallback((v: string | null) => { setOpen(false); resolver.current?.(v); resolver.current = null; }, []);
  const scan = useCallback(() => new Promise<string | null>((resolve) => { resolver.current = resolve; setOpen(true); }), []);
  const el = (
    <Modal visible={open} animationType="slide" onRequestClose={() => finish(null)}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {open ? <ScannerView onScan={(c) => finish(c)} /> : null}
        <Pressable onPress={() => finish(null)} style={{ position: 'absolute', top: 44, right: 16, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 22, padding: 10 }}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
  return [el, scan];
}
