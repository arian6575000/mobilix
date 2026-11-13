import { Platform } from 'react-native';

// "Quiet professional": neutral surfaces, ONE accent (indigo). Teal only means money-in / paid, red only means due / overdue.
export const C = {
  bg: '#F6F7F9',
  card: '#FFFFFF',
  surface: '#FFFFFF',
  subtle: '#F1F3F6', // inputs, segmented track, pressed rows
  line: '#E5E7EB',
  ink: '#0F172A',
  soft: '#475569',
  faint: '#94A3B8',
  primary: '#4F46E5',
  primaryDark: '#4338CA',
  primarySoft: '#EEF0FF',
  success: '#0D9488',
  successSoft: '#E6F6F4',
  danger: '#DC2626',
  dangerSoft: '#FDECEC',
  warning: '#B45309',
  warningSoft: '#FEF3E2',
  white: '#FFFFFF',
};

export const TONES = {
  indigo: { bg: C.primarySoft, fg: C.primary },
  teal: { bg: C.successSoft, fg: C.success },
  red: { bg: C.dangerSoft, fg: C.danger },
  amber: { bg: C.warningSoft, fg: C.warning },
  slate: { bg: C.subtle, fg: C.soft },
};
export type Tone = keyof typeof TONES;

export const R = { sm: 10, md: 14, lg: 18, pill: 999 };

// English: Inter (loaded in the root layout). Urdu: one place to change when the Nastaleeq font file is added.
export const FONT = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semi: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};
export const FONT_UR = 'NotoNastaliqUrdu_400Regular'; // TODO: swap for Jameel Noori Nastaleeq / Alvi Nastaleeq once the .ttf is added
export const FONT_UR_BOLD = 'NotoNastaliqUrdu_700Bold';
// Nastaleeq glyphs are tall: Urdu text needs a larger line height than Latin text.
export const URDU_LINE = 2.0;

/** Cards use a hairline border; a very soft shadow on iOS only. Android elevation stays 0 (avoids grey shadow boxes). */
export const cardShadow = Platform.select({
  ios: { shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  default: {},
}) as object;

/** Kept for components copied from the template app. */
export const shadow = cardShadow;
