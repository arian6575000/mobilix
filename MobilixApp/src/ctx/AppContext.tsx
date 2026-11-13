import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, I18nManager, Platform, StyleSheet, Text, View } from 'react-native';
import { Repo } from '../db/repo';
import { DEFAULT_SETTINGS, Settings } from '../db/types';
import { Lang, translate } from '../lib/i18n';
import { Fmt } from '../lib/format';
import { C, FONT, FONT_UR_BOLD, R } from '../lib/theme';

type ToastType = 'default' | 'success' | 'error';
interface Ctx {
  settings: Settings;
  lang: Lang;
  rtl: boolean;
  t: (key: string, lang?: Lang) => string;
  setLang: (l: Lang) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  reloadSettings: () => Promise<void>;
  /** branch new records are written to (the active branch, else the main one) */
  branchId: number;
  /** branch the lists and totals are filtered to; null = all branches */
  viewBranch: number | null;
  /** money using the shop's currency setting */
  money: (n: number | string | null | undefined) => string;
  toast: (msg: string, type?: ToastType) => void;
  confirm: (message: string, opts?: { title?: string; danger?: boolean; okLabel?: string }) => Promise<boolean>;
}
const AppCtx = createContext<Ctx>(null as any);
export const useApp = () => useContext(AppCtx);

try { I18nManager.allowRTL(false); I18nManager.forceRTL(false); } catch { /* layout direction is handled manually */ }

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const lang: Lang = settings.language === 'ur' ? 'ur' : 'en';
  Fmt.currency = settings.currency || DEFAULT_SETTINGS.currency;

  const [mainBranch, setMainBranch] = useState(1);
  const reloadSettings = useCallback(async () => { setSettings(await Repo.getSettings()); setMainBranch(await Repo.defaultBranchId()); }, []);
  useEffect(() => { reloadSettings(); }, [reloadSettings]);

  // ---- toast ----
  const [toastState, setToastState] = useState<{ msg: string; type: ToastType } | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((msg: string, type: ToastType = 'default') => {
    if (timer.current) clearTimeout(timer.current);
    setToastState({ msg, type });
    Animated.timing(anim, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToastState(null));
    }, 2200);
  }, [anim]);

  const t = useCallback((key: string, l?: Lang) => translate(key, l || lang), [lang]);
  const money = useCallback((n: number | string | null | undefined) => Fmt.money(n, settings.currency), [settings.currency]);

  const confirm = useCallback((message: string, opts: { title?: string; danger?: boolean; okLabel?: string } = {}) =>
    new Promise<boolean>((resolve) => {
      Alert.alert(opts.title || translate('areYouSure', lang), message, [
        { text: translate('cancel', lang), style: 'cancel', onPress: () => resolve(false) },
        { text: opts.okLabel || translate('confirm', lang), style: opts.danger ? 'destructive' : 'default', onPress: () => resolve(true) },
      ], { cancelable: true, onDismiss: () => resolve(false) });
    }), [lang]);

  const saveSettings = useCallback(async (s: Settings) => { await Repo.saveSettings(s); setSettings(s); }, []);
  const setLang = useCallback(async (l: Lang) => { await saveSettings({ ...(await Repo.getSettings()), language: l }); }, [saveSettings]);

  const value = useMemo<Ctx>(() => ({
    settings, lang, rtl: lang === 'ur', t, setLang, saveSettings, reloadSettings, money, toast, confirm,
    branchId: settings.activeBranchId ?? mainBranch, viewBranch: settings.activeBranchId,
  }), [settings, lang, t, setLang, saveSettings, reloadSettings, money, toast, confirm, mainBranch]);

  return (
    <AppCtx.Provider value={value}>
      {children}
      {toastState && (
        <Animated.View pointerEvents="none" style={[styles.toastWrap, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }]}>
          <View style={[styles.toast, toastState.type === 'error' && { backgroundColor: C.danger }, toastState.type === 'success' && { backgroundColor: C.success }]}>
            <Text style={[styles.toastText, lang === 'ur' && { fontFamily: FONT_UR_BOLD, lineHeight: 30 }]}>{toastState.msg}</Text>
          </View>
        </Animated.View>
      )}
    </AppCtx.Provider>
  );
}

const styles = StyleSheet.create({
  toastWrap: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 40, left: 16, right: 16, alignItems: 'center', zIndex: 999 },
  toast: { backgroundColor: C.ink, paddingHorizontal: 18, paddingVertical: 10, borderRadius: R.pill, maxWidth: '100%' },
  toastText: { color: '#fff', fontSize: 14, fontFamily: FONT.semi, textAlign: 'center' },
});
