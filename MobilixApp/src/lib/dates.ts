const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => ymd(new Date());

export function addDays(n: number, from?: string): string {
  const d = from ? parseYmd(from) : new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
}
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function daysFromToday(s: string): number | null {
  if (!s || !/^\d{4}-\d\d-\d\d$/.test(s)) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((parseYmd(s).getTime() - now.getTime()) / 86400000);
}
export function monthRange(y: number, m: number): [string, string] {
  return [`${y}-${pad(m + 1)}-01`, `${y}-${pad(m + 1)}-31`];
}

/** Add whole months, keeping the day of month but clamping to the last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(s: string, n: number): string {
  const d = parseYmd(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return ymd(d);
}

/** First and last day (YYYY-MM-DD) of the month that is `offset` months from this one (0 = this month, -1 = last month). */
export function monthBounds(offset = 0): { from: string; to: string } {
  const n = new Date();
  const first = new Date(n.getFullYear(), n.getMonth() + offset, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  return { from: ymd(first), to: ymd(last) };
}
