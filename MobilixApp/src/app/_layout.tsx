import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, View, Text } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SQLite from 'expo-sqlite';
import * as ScreenCapture from 'expo-screen-capture';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { NotoNastaliqUrdu_400Regular, NotoNastaliqUrdu_700Bold } from '@expo-google-fonts/noto-nastaliq-urdu';
import { useFonts } from 'expo-font';
import { AppProvider } from '../ctx/AppContext';
import { initRepo } from '../db/repo';
import { fromExpo } from '../db/expoAdapter';
import { hasPin } from '../lib/lock';
import { LockScreen } from '../ui/LockScreen';
import LicenseGate from '../license/LicenseGate';
import { C } from '../lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, NotoNastaliqUrdu_400Regular, NotoNastaliqUrdu_700Bold,
  });
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  // Customer data and documents: no screenshots / screen recording, and the recent-apps thumbnail is blanked (Android FLAG_SECURE).
  useEffect(() => { ScreenCapture.preventScreenCaptureAsync().catch(() => {}); }, []);

  useEffect(() => {
    (async () => {
      try {
        const db = await SQLite.openDatabaseAsync('mobilix.db');
        await db.execAsync('PRAGMA journal_mode = WAL;');
        await initRepo(fromExpo(db));
        setLocked(await hasPin());
        setDbReady(true);
      } catch (e: any) { setDbError(String(e?.message || e)); }
    })();
  }, []);

  // Re-lock when the app has been in the background for over a minute.
  const hiddenAt = useRef(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (s) => {
      if (s === 'background' || s === 'inactive') { if (!hiddenAt.current) hiddenAt.current = Date.now(); return; }
      if (s === 'active' && hiddenAt.current && Date.now() - hiddenAt.current > 60000 && (await hasPin())) setLocked(true);
      hiddenAt.current = 0;
    });
    return () => sub.remove();
  }, []);

  const ready = (fontsLoaded || !!fontError) && dbReady;
  useEffect(() => { if (ready || dbError) SplashScreen.hideAsync().catch(() => {}); }, [ready, dbError]);
  const unlock = useCallback(() => setLocked(false), []);

  if (dbError) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.bg }}><Text style={{ color: C.danger, fontWeight: '700' }}>Could not open the database</Text><Text style={{ marginTop: 8, color: C.soft }}>{dbError}</Text></View>;
  }
  if (!ready) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator color={C.primary} /></View>;
  }
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <LicenseGate>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'fade_from_bottom' }} />
        </LicenseGate>
        {locked ? <LockScreen onUnlock={unlock} /> : null}
      </AppProvider>
    </SafeAreaProvider>
  );
}
