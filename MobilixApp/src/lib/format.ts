import type { Lang } from './i18n';
import type { CurrencyCfg } from '../db/types';
import { CURRENCIES } from '../db/types';
import { daysFromToday, parseYmd } from './dates';

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_UR = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];

export const Fmt: {
  currency: CurrencyCfg;
  money(amount: number | string | null | undefined, cfg?: CurrencyCfg): string;
  date(v: string | number | null | undefined, lang?: Lang, short?: boolean): string;
  initials(name?: string): string;
  daysFromToday: typeof daysFromToday;
} = {
  /** Set from Settings by the app provider; every screen, receipt and report formats money through this. */
  currency: CURRENCIES[0] as CurrencyCfg,
  money(amount, cfg = Fmt.currency) {
    const n = Number(amount) || 0;
    const fixed = Math.abs(n).toFixed(cfg.decimals);
    const [int, dec] = fixed.split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const body = dec ? `${grouped}.${dec}` : grouped;
    const sign = n < 0 && Number(fixed) !== 0 ? '-' : '';
    return cfg.symbolAfter ? `${sign}${body} ${cfg.symbol}` : `${sign}${cfg.symbol} ${body}`;
  },
  /** Accepts 'YYYY-MM-DD' or a timestamp. */
  date(v, lang = 'en', short = false) {
    if (!v) return '—';
    const d = typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) ? parseYmd(v) : new Date(v);
    if (isNaN(d.getTime())) return '—';
    const names = lang === 'ur' ? MONTHS_UR : MONTHS_EN;
    const mn = short && lang === 'en' ? names[d.getMonth()].slice(0, 3) : names[d.getMonth()];
    return `${d.getDate()} ${mn} ${d.getFullYear()}`;
  },
  initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).slice(0, 2).map((w) => Array.from(w)[0]?.toUpperCase() || '').join('');
  },
  daysFromToday,
};

/** Phone → WhatsApp international digits (default country code from settings). */
export function waNumber(phone: string | undefined, cc = '92'): string {
  const d = String(phone || '').replace(/[^\d]/g, '');
  if (!d) return '';
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0')) return cc + d.slice(1);
  return d;
}
