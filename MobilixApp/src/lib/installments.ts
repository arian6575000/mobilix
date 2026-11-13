import { addMonths } from './dates';

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface ScheduleRow { seq: number; dueDate: string; amount: number }

/** Split `remaining` into `months` equal monthly parts (2 decimals); the last part takes the rounding remainder. */
export function buildSchedule(remaining: number, months: number, firstDue: string): ScheduleRow[] {
  if (!(remaining > 0)) throw new Error('Nothing left to put on installments');
  if (!Number.isInteger(months) || months < 1 || months > 60) throw new Error('Months must be between 1 and 60');
  if (!/^\d{4}-\d\d-\d\d$/.test(firstDue)) throw new Error('First due date is required');
  const base = Math.floor((remaining * 100) / months) / 100;
  const rows: ScheduleRow[] = [];
  let left = r2(remaining);
  for (let i = 0; i < months; i++) {
    const amount = i === months - 1 ? left : base;
    rows.push({ seq: i + 1, dueDate: addMonths(firstDue, i), amount });
    left = r2(left - amount);
  }
  return rows;
}

/** Oldest unpaid first. Returns how much goes to each installment and what could not be placed. */
export function allocate(rows: { id: number; amount: number; paid: number }[], payment: number): { alloc: { id: number; add: number }[]; rest: number } {
  let left = r2(payment);
  const alloc: { id: number; add: number }[] = [];
  for (const r of rows) {
    if (left <= 0) break;
    const open = r2(r.amount - r.paid);
    if (open <= 0) continue;
    const add = Math.min(open, left);
    alloc.push({ id: r.id, add: r2(add) });
    left = r2(left - add);
  }
  return { alloc, rest: left };
}
