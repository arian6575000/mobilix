import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleProp, StyleSheet, Text,
  TextInput, TextInputProps, TextStyle, View, ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useApp } from '../ctx/AppContext';
import { C, cardShadow, FONT, FONT_UR, FONT_UR_BOLD, GRAD, R, Tone, TONES, URDU_LINE } from '../lib/theme';
import { CREDIT } from '../lib/brand';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------- Text
interface TProps { children?: React.ReactNode; size?: number; bold?: boolean; color?: string; style?: StyleProp<TextStyle>; center?: boolean; numberOfLines?: number; selectable?: boolean; num?: boolean }
export function T({ children, size = 15, bold, color = C.ink, style, center, numberOfLines, selectable, num }: TProps) {
  const { rtl } = useApp();
  const base: TextStyle = rtl
    ? { fontSize: size + 1, color, textAlign: center ? 'center' : 'right', fontFamily: bold ? FONT_UR_BOLD : FONT_UR, lineHeight: Math.round(size * URDU_LINE), writingDirection: 'rtl' }
    : { fontSize: size, color, textAlign: center ? 'center' : 'left', fontFamily: bold ? FONT.semi : FONT.regular, ...(num ? { fontVariant: ['tabular-nums'] } : {}) };
  return <Text selectable={selectable} numberOfLines={numberOfLines} style={[base, style]}>{children}</Text>;
}
export const Muted = (p: TProps) => <T size={13} color={C.faint} {...p} />;

// ---------------------------------------------------------------- Layout
export function Row({ children, style, gap = 10, align = 'center', wrap }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number; align?: ViewStyle['alignItems']; wrap?: boolean }) {
  const { rtl } = useApp();
  return <View style={[{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: align, gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function Card({ children, style, onPress, flush }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; flush?: boolean }) {
  const inner = [styles.card, flush && { paddingVertical: 4 }, style];
  if (onPress) return <Pressable onPress={onPress} android_ripple={{ color: C.primarySoft }} style={({ pressed }) => [inner, pressed && { backgroundColor: C.subtle }]}>{children}</Pressable>;
  return <View style={inner}>{children}</View>;
}

export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: 20, marginBottom: 8, paddingHorizontal: 2 }}>
      <T size={12} bold color={C.faint} style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}>{children}</T>
      {right}
    </Row>
  );
}

export function KV({ k, v, vColor }: { k: string; v: React.ReactNode; vColor?: string }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }} gap={12} align="flex-start">
      <T size={13.5} color={C.faint} style={{ flexShrink: 0 }}>{k}</T>
      {typeof v === 'string' || typeof v === 'number' ? <T bold size={14} color={vColor} style={{ flex: 1 }} num>{v}</T> : v}
    </Row>
  );
}

export function Divider() { return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.line }} />; }

// ---------------------------------------------------------------- Buttons
interface BProps { label?: string; icon?: IconName; onPress?: () => void; variant?: 'primary' | 'ghost' | 'danger'; small?: boolean; block?: boolean; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle> }
export function Button({ label, icon, onPress, variant = 'primary', small, block, disabled, loading, style }: BProps) {
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? C.danger : C.primary;
  const bg = variant === 'danger' ? C.dangerSoft : C.card;
  const border = variant === 'ghost' ? C.primarySoft : 'transparent';
  const content = (
    <Row gap={8} style={{ justifyContent: 'center' }}>
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon ? <Ionicons name={icon} size={small ? 16 : 19} color={fg} /> : null}
      {label ? <T bold size={small ? 13 : 15} color={fg} center>{label}</T> : null}
    </Row>
  );
  const pad = { paddingVertical: small ? 8 : 14, paddingHorizontal: small ? 14 : 20 };
  return (
    <Pressable
      disabled={disabled || loading} onPress={onPress} android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
      style={({ pressed }) => [{ borderRadius: R.md + 2, overflow: 'hidden', opacity: disabled ? 0.45 : pressed ? 0.9 : 1, ...(block ? { flex: 1 } : {}) },
        variant === 'primary' ? cardShadow : { backgroundColor: pressed ? C.subtle : bg, borderColor: border, borderWidth: 1.5 }, style]}>
      {variant === 'primary'
        ? <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={pad}>{content}</LinearGradient>
        : <View style={pad}>{content}</View>}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, color, size = 20, style, glass }: { icon: IconName; onPress?: () => void; color?: string; size?: number; style?: StyleProp<ViewStyle>; glass?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} android_ripple={{ color: C.primarySoft, radius: 22 }} style={({ pressed }) => [styles.iconBtn, glass && { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'transparent' }, pressed && { opacity: 0.75 }, style]}>
      <Ionicons name={icon} size={size} color={color || (glass ? '#fff' : C.ink)} />
    </Pressable>
  );
}

// ---------------------------------------------------------------- Screen + TopBar
interface ScreenProps {
  title?: string; subtitle?: string; back?: boolean; right?: React.ReactNode; children?: React.ReactNode;
  scroll?: boolean; onRefresh?: () => Promise<void> | void; padBottom?: number; edges?: ('top' | 'bottom')[];
}
export function Screen({ title, subtitle, back, right, children, scroll = true, onRefresh, padBottom = 40, edges = ['top'] }: ScreenProps) {
  const { rtl } = useApp();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  // Tablets: keep content in a readable column instead of stretching edge to edge.
  const column: ViewStyle = { width: '100%', maxWidth: 720, alignSelf: 'center' };
  const hasHeader = !!(title || back);
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[{ padding: 16, paddingBottom: padBottom }, column]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await onRefresh(); setRefreshing(false); }} /> : undefined}>
      {children}
    </ScrollView>
  ) : <View style={[{ flex: 1, padding: 16 }, column]}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: hasHeader || !edges.includes('top') ? 0 : insets.top }}>
      {hasHeader && (
        <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <View style={styles.headerCircle} pointerEvents="none" />
          <Row style={[{ paddingHorizontal: 16, paddingTop: insets.top + 10, minHeight: 56 + insets.top }, column]} gap={10}>
            {back ? <IconButton glass icon={rtl ? 'arrow-forward' : 'arrow-back'} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} /> : null}
            <View style={{ flex: 1 }}>
              {subtitle ? <T size={13} color="rgba(255,255,255,0.8)">{subtitle}</T> : null}
              <T size={22} bold color="#fff" numberOfLines={1}>{title}</T>
            </View>
            {right}
          </Row>
        </LinearGradient>
      )}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{body}</KeyboardAvoidingView>
    </View>
  );
}

export function Loading() {
  const { t } = useApp();
  return <View style={{ paddingVertical: 60, alignItems: 'center' }}><ActivityIndicator color={C.primary} /><Muted style={{ marginTop: 10 }}>{t('loading')}</Muted></View>;
}

export function Empty({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
      <View style={[styles.round(52), { backgroundColor: C.primarySoft }]}><Ionicons name={icon} size={24} color={C.primary} /></View>
      <T bold size={16} center style={{ marginTop: 14 }}>{title}</T>
      {text ? <T size={13.5} color={C.faint} center style={{ marginTop: 4, maxWidth: 280 }}>{text}</T> : null}
      {action ? <View style={{ marginTop: 16 }}>{action}</View> : null}
    </Card>
  );
}

// ---------------------------------------------------------------- Inputs
interface FProps extends Omit<TextInputProps, 'style' | 'onChangeText'> { label?: string; onChangeText?: (v: string) => void; style?: StyleProp<ViewStyle>; hint?: string; ltr?: boolean }
export function Field({ label, style, hint, ltr, multiline, ...rest }: FProps) {
  const { rtl } = useApp();
  const alignRight = rtl && !ltr;
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? <T size={12.5} bold color={C.soft} style={{ marginBottom: 6 }}>{label}</T> : null}
      <TextInput
        {...rest} multiline={multiline} placeholderTextColor={C.faint}
        style={[styles.input, multiline && { minHeight: 80, textAlignVertical: 'top' }, { textAlign: alignRight ? 'right' : 'left', writingDirection: alignRight ? 'rtl' : 'ltr', fontFamily: alignRight ? FONT_UR : FONT.regular }]}
      />
      {hint ? <Muted style={{ marginTop: 4 }}>{hint}</Muted> : null}
    </View>
  );
}
export const NumField = (p: FProps) => <Field keyboardType="decimal-pad" ltr {...p} />;

export function Segmented<V extends string>({ items, value, onChange }: { items: [V, string][]; value: V; onChange: (v: V) => void }) {
  const { rtl } = useApp();
  return (
    <View style={[styles.segmented, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
      {items.map(([v, label]) => (
        <Pressable key={v} onPress={() => onChange(v)} style={[styles.segBtn, v === value && styles.segActive]}>
          <T size={13.5} bold={v === value} color={v === value ? C.ink : C.soft} center numberOfLines={1}>{label}</T>
        </Pressable>
      ))}
    </View>
  );
}

export function Chips<V extends string>({ items, value, onChange }: { items: [V, string][]; value: V; onChange: (v: V) => void }) {
  const { rtl } = useApp();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, flexGrow: 0 }} contentContainerStyle={{ gap: 8, flexDirection: rtl ? 'row-reverse' : 'row', paddingHorizontal: 2 }}>
      {items.map(([v, label]) => (
        <Pressable key={v} onPress={() => onChange(v)} style={[styles.chip, v === value && styles.chipOn]}>
          <T size={13.5} bold={v === value} color={v === value ? '#fff' : C.soft}>{label}</T>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function SearchBar({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder: string }) {
  const { rtl } = useApp();
  return (
    <Row style={styles.search} gap={8}>
      <Ionicons name="search" size={18} color={C.faint} />
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.faint}
        style={{ flex: 1, fontSize: 15, paddingVertical: 10, color: C.ink, textAlign: rtl ? 'right' : 'left', fontFamily: rtl ? FONT_UR : FONT.regular }} />
      {value ? <IconButton icon="close-circle" size={18} color={C.faint} onPress={() => onChangeText('')} style={{ width: 28, height: 28, borderWidth: 0, backgroundColor: 'transparent' }} /> : null}
    </Row>
  );
}

export function CheckRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)}>
      <Row gap={10} style={{ paddingVertical: 12 }}>
        <View style={[styles.check, value && { backgroundColor: C.primary, borderColor: C.primary }]}>{value ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}</View>
        <T bold size={14}>{label}</T>
      </Row>
    </Pressable>
  );
}

export interface Option { value: string; label: string; sub?: string; group?: string }
export function SelectField({ label, value, options, onChange, placeholder, searchable, footer }: {
  label?: string; value: string; options: Option[]; onChange: (v: string) => void; placeholder?: string; searchable?: boolean; footer?: React.ReactNode;
}) {
  const { t, rtl } = useApp();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const cur = options.find((o) => o.value === value);
  const list = useMemo(() => (q.trim() ? options.filter((o) => `${o.label} ${o.sub || ''}`.toLowerCase().includes(q.trim().toLowerCase())) : options), [options, q]);
  let lastGroup: string | undefined;
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <T size={12.5} bold color={C.soft} style={{ marginBottom: 6 }}>{label}</T> : null}
      <Pressable onPress={() => { setQ(''); setOpen(true); }} style={[styles.input, { flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, paddingVertical: 11 }]}>
        <T size={15} color={cur ? C.ink : C.faint} style={{ flex: 1 }} numberOfLines={1}>{cur ? cur.label : placeholder || t('select')}</T>
        <Ionicons name="chevron-down" size={18} color={C.faint} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label} scroll>
        {searchable ? <SearchBar value={q} onChangeText={setQ} placeholder={t('search')} /> : null}
        {list.map((o) => {
          const header = o.group && o.group !== lastGroup ? <Muted key={`g-${o.group}`} style={{ paddingTop: 12, paddingBottom: 2 }}>{o.group}</Muted> : null;
          lastGroup = o.group;
          return (
            <React.Fragment key={o.value}>
              {header}
              <Pressable onPress={() => { onChange(o.value); setOpen(false); }} style={{ paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }}>
                <Row gap={8} style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <T size={15} bold={o.value === value} color={o.value === value ? C.primary : C.ink}>{o.label}</T>
                    {o.sub ? <Muted>{o.sub}</Muted> : null}
                  </View>
                  {o.value === value ? <Ionicons name="checkmark" size={18} color={C.primary} /> : null}
                </Row>
              </Pressable>
            </React.Fragment>
          );
        })}
        {!list.length ? <Muted style={{ paddingVertical: 20 }} center>{t('noMatches')}</Muted> : null}
        {footer}
      </Sheet>
    </View>
  );
}

// ---------------------------------------------------------------- Sheet (bottom sheet)
export function Sheet({ visible, onClose, title, children, scroll }: { visible: boolean; onClose: () => void; title?: string; children?: React.ReactNode; scroll?: boolean }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={onClose} />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            {title ? <T bold size={17} center style={{ marginBottom: 10 }}>{title}</T> : null}
            {scroll ? <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }}>{children}</ScrollView> : children}
            <View style={{ height: 14 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Company credit line (RetailX Solution). */
export function Credit({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ alignItems: 'center', paddingVertical: 16 }, style]}><Text selectable style={{ fontSize: 11.5, color: C.faint, letterSpacing: 0.3, fontFamily: FONT.regular }}>{`Developed by ${CREDIT}`}</Text></View>;
}

// ---------------------------------------------------------------- Display bits
export function Badge({ tone = 'slate', label }: { tone?: Tone; label: string }) {
  const c = TONES[tone];
  return <View style={{ backgroundColor: c.bg, paddingHorizontal: 9, paddingVertical: 2, borderRadius: R.pill, alignSelf: 'flex-start' }}><T size={11.5} bold color={c.fg}>{label}</T></View>;
}

export function Avatar({ text, icon, size = 44 }: { text?: string; icon?: IconName; size?: number }) {
  return (
    <View style={[styles.round(size), { borderRadius: size * 0.3, backgroundColor: C.primarySoft }]}>
      {icon ? <Ionicons name={icon} size={size * 0.46} color={C.primary} /> : <Text style={{ color: C.primary, fontFamily: FONT.bold, fontSize: size * 0.36 }}>{text}</Text>}
    </View>
  );
}

export function ListItem({ title, sub, sub2, left, trail, onPress, last }: { title: React.ReactNode; sub?: React.ReactNode; sub2?: React.ReactNode; left?: React.ReactNode; trail?: React.ReactNode; onPress?: () => void; last?: boolean }) {
  const { rtl } = useApp();
  const inner = (
    <Row gap={12} style={{ paddingVertical: 12, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: C.line }}>
      {left}
      <View style={{ flex: 1 }}>
        {typeof title === 'string' ? <T bold size={15} numberOfLines={1}>{title}</T> : title}
        {sub ? (typeof sub === 'string' ? <Muted numberOfLines={1}>{sub}</Muted> : sub) : null}
        {sub2 ? (typeof sub2 === 'string' ? <Muted numberOfLines={1}>{sub2}</Muted> : sub2) : null}
      </View>
      {trail ? <View style={{ alignItems: rtl ? 'flex-start' : 'flex-end' }}>{trail}</View> : null}
    </Row>
  );
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => pressed && { backgroundColor: C.subtle }}>{inner}</Pressable> : inner;
}

/** Stat tile (mockup style): tinted card, round icon chip, small label, large number. */
export function Tile({ label, value, tone = 'indigo', icon, onPress, style }: { label: string; value: string | number; tone?: Tone; icon?: IconName; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const { rtl } = useApp();
  const c = TONES[tone];
  return (
    <Card onPress={onPress} style={[{ flexBasis: '47%', flexGrow: 1, marginBottom: 0, backgroundColor: c.bg, borderColor: 'transparent', elevation: 0, alignItems: rtl ? 'flex-end' : 'flex-start' }, style]}>
      {icon ? <View style={[styles.round(34), { backgroundColor: c.fg, borderRadius: 11, marginBottom: 10 }]}><Ionicons name={icon} size={18} color="#fff" /></View> : null}
      <T size={13} color={C.soft}>{label}</T>
      <T bold size={19} num color={C.ink} style={{ marginTop: 3 }} numberOfLines={1}>{String(value)}</T>
    </Card>
  );
}

export function Hero({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View style={styles.heroCircleA} pointerEvents="none" />
      <View style={styles.heroCircleB} pointerEvents="none" />
      <T size={13.5} color="rgba(255,255,255,0.8)">{label}</T>
      <T bold size={32} color="#fff" num style={{ marginTop: 4 }} numberOfLines={1}>{value}</T>
      {hint ? <T size={12.5} color="rgba(255,255,255,0.75)" style={{ marginTop: 6 }}>{hint}</T> : null}
    </LinearGradient>
  );
}

export const Grid = ({ children }: { children?: React.ReactNode }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{children}</View>;

// ---------------------------------------------------------------- styles
const styles = {
  card: { backgroundColor: C.card, borderRadius: R.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.line, ...cardShadow } as ViewStyle,
  hero: { borderRadius: R.lg + 4, padding: 20, marginBottom: 12, overflow: 'hidden' } as ViewStyle,
  heroCircleA: { position: 'absolute', right: -30, top: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.10)' } as ViewStyle,
  heroCircleB: { position: 'absolute', right: 40, bottom: -50, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.07)' } as ViewStyle,
  header: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingBottom: 18, overflow: 'hidden' } as ViewStyle,
  headerCircle: { position: 'absolute', right: -40, top: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.08)' } as ViewStyle,
  iconBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' } as ViewStyle,
  input: { backgroundColor: C.card, borderRadius: R.md + 2, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: C.ink } as TextStyle,
  segmented: { backgroundColor: C.subtle, borderRadius: R.md, padding: 3 } as ViewStyle,
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: R.sm + 1, justifyContent: 'center' } as ViewStyle,
  segActive: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line } as ViewStyle,
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: R.pill, backgroundColor: C.card, borderWidth: 1, borderColor: C.line } as ViewStyle,
  chipOn: { backgroundColor: C.primary, borderColor: C.primary } as ViewStyle,
  search: { backgroundColor: C.card, borderRadius: R.lg, paddingHorizontal: 14, marginBottom: 12, borderWidth: 1, borderColor: C.line } as ViewStyle,
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' } as ViewStyle,
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' } as ViewStyle,
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' } as ViewStyle,
  sheet: { width: '100%', maxWidth: 560, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18, paddingTop: 10 } as ViewStyle,
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', marginBottom: 12 } as ViewStyle,
  round: (s: number): ViewStyle => ({ width: s, height: s, borderRadius: s / 2, alignItems: 'center', justifyContent: 'center' }),
};

// ---------------------------------------------------------------- Full-screen modal (long forms opened from a list)
export function FullModal({ visible, title, onClose, children, footer }: { visible: boolean; title: string; onClose: () => void; children?: React.ReactNode; footer?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Row style={{ paddingHorizontal: 16, paddingTop: insets.top + 10, minHeight: 56 + insets.top }} gap={10}>
            <IconButton glass icon="close" onPress={onClose} />
            <T size={19} bold color="#fff" style={{ flex: 1 }} numberOfLines={1}>{title}</T>
          </Row>
        </LinearGradient>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30, width: '100%', maxWidth: 720, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
          {footer ? <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.card }}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
