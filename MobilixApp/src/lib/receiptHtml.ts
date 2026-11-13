// Pure HTML builders for receipts, statements and QR labels (no native imports, so they can be previewed and tested in Node).
// Layout uses flex rows instead of wide tables, so it stays readable on 58 mm / 80 mm thermal paper as well as A4.
import type { Accessory, Party, LedgerEntry, Phone, SaleDetail, Settings } from '../db/types';
import { Fmt } from './format';
import { CREDIT } from './brand';
import { qrSvg } from './qr';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export type Paper = 'a4' | 58 | 80;
export const isThermal = (p: Paper) => p !== 'a4';

/** Page width in CSS pixels at 72 PPI (what expo-print expects): 58 mm = 164, 80 mm = 227. */
export const paperPx = (p: Paper) => (p === 58 ? 164 : p === 80 ? 227 : 595);

/** Thermal rolls have no fixed height: estimate it from the content so the PDF is not a mostly empty page. */
export function estimateHeight(html: string, paper: Paper): number {
  const rows = (html.match(/class="row/g) || []).length;
  const subs = (html.match(/class="sub/g) || []).length;
  const hrs = (html.match(/<hr/g) || []).length;
  const labs = (html.match(/class="lab"/g) || []).length;
  // Calibrated against real renders at 72 PPI (80 mm: 639 px for a 3-item installment receipt). Errs on the tall side: extra blank paper is better than a cut-off total.
  const base = labs ? 30 : 240;
  const raw = base + rows * 24 + subs * 16 + hrs * 14 + labs * 90;
  return Math.max(260, Math.round(raw * (paper === 58 ? 1.15 : 1.08)));
}

const css = (paper: Paper) => {
  const th = isThermal(paper);
  const f = th ? (paper === 58 ? 10.5 : 11.5) : 13;
  return `
  @page{size:${th ? `${paper}mm auto` : 'A4'};margin:${th ? '0' : '12mm'}}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff}
  body{font-family:-apple-system,Roboto,'Helvetica Neue',Arial,sans-serif;color:#111827;font-size:${f}px;line-height:1.35;padding:${th ? '3mm 3mm 4mm' : '0'};${th ? '' : 'max-width:720px;margin:0 auto;'}}
  .brand{text-align:center;margin-bottom:${th ? 4 : 10}px}
  .brand h1{font-size:${th ? f + 4 : 26}px;margin:0;letter-spacing:.2px;font-weight:800;color:${th ? '#000' : '#3A1FC4'}}
  .brand .sub0{color:#6b7280;font-size:${f - 1}px;margin-top:2px}
  .title{text-align:center;font-weight:700;font-size:${f + 1}px;margin:${th ? 4 : 10}px 0 ${th ? 2 : 6}px;${th ? 'border-top:1px dashed #000;border-bottom:1px dashed #000;padding:3px 0' : ''}}
  .meta{display:flex;justify-content:space-between;gap:8px;font-size:${f - 0.5}px;color:#4b5563;margin:2px 0}
  .meta b{color:#111827}
  .row{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:${th ? 3 : 8}px 0;${th ? '' : 'border-bottom:1px solid #eef0f4;'}}
  .row .l{flex:1;min-width:0;word-break:break-word}
  .row .r{white-space:nowrap;font-weight:600;text-align:right}
  .sub{color:#6b7280;font-size:${f - 1}px;font-weight:400}
  .sum .row{border:0;padding:${th ? 1.5 : 4}px 0}
  .sum .row .l{color:#4b5563}
  .grand{display:flex;justify-content:space-between;align-items:center;margin:${th ? 5 : 10}px 0 ${th ? 3 : 6}px;padding:${th ? '4px 0' : '12px 14px'};font-weight:800;font-size:${th ? f + 3 : 18}px;${th ? 'border-top:2px solid #000;border-bottom:2px solid #000' : 'background:#ECE9FF;border-radius:10px;color:#3A1FC4'}}
  .due{color:${th ? '#000' : '#b91c1c'};font-weight:800}
  .head{font-weight:700;margin:${th ? 6 : 14}px 0 2px;font-size:${f + 0.5}px}
  hr{border:0;border-top:1px dashed ${th ? '#000' : '#c4c8d4'};margin:${th ? 6 : 12}px 0}
  .thanks{text-align:center;font-weight:600;margin-top:${th ? 8 : 18}px}
  .foot{margin-top:${th ? 6 : 14}px;text-align:center;font-size:${f - 1.5}px;color:#6b7280}
  .paid{color:${th ? '#000' : '#0f766e'}}
  .cols{display:flex;gap:6px;font-size:${f - 1}px;color:#6b7280;border-bottom:1px solid ${th ? '#000' : '#cbd5e1'};padding-bottom:2px}
  `;
};
const page = (paper: Paper, body: string, extra = '') => `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${css(paper)}${extra}</style></head><body>${body}</body></html>`;

function shopHead(s: Settings, title: string) {
  const line = [s.address, s.phone].filter(Boolean).join(' · ');
  return `<div class="brand"><h1>${esc(s.shopName || 'Mobilix')}</h1>${line ? `<div class="sub0">${esc(line)}</div>` : ''}</div><div class="title">${esc(title)}</div>`;
}
const foot = (s: Settings) => `${s.receiptFooter ? `<div class="thanks">${esc(s.receiptFooter)}</div>` : ''}<div class="foot">Developed by ${esc(CREDIT)}</div>`;
const line = (l: string, r: string, cls = '') => `<div class="row ${cls}"><div class="l">${l}</div><div class="r">${r}</div></div>`;

export function saleReceiptHtml(d: SaleDetail, s: Settings, paper: Paper): string {
  const m = (n: number) => Fmt.money(n, s.currency);
  const sale = d.sale;
  const items = d.items.map((i) => line(
    `${esc(i.label)}${i.sub ? `<div class="sub">${esc(i.sub)}</div>` : ''}<div class="sub">${i.qty} × ${m(i.price)}</div>`, m(i.price * i.qty))).join('');
  const subtotal = d.items.reduce((a, i) => a + i.price * i.qty, 0);
  const sum: string[] = [];
  if (sale.discount || sale.markup) sum.push(line('Subtotal', m(subtotal)));
  if (sale.discount) sum.push(line('Discount', `-${m(sale.discount)}`));
  if (sale.markup) sum.push(line('Installment charges', m(sale.markup)));
  if (sale.exchangeValue) sum.push(line(`Trade-in${d.exchangePhone ? ` (${esc(d.exchangePhone.brand + ' ' + d.exchangePhone.model)})` : ''}`, `-${m(sale.exchangeValue)}`));
  const payable = sale.total - sale.exchangeValue;
  const sched = d.installments.length
    ? `<hr/><div class="head">Installment plan</div>${d.installments.map((i) => line(`${i.seq}. ${esc(Fmt.date(i.dueDate, 'en', true))}`, `${m(i.amount)}${i.paid ? ` <span class="paid">(paid ${m(i.paid)})</span>` : ''}`)).join('')}` : '';
  const phoneNote = d.items.some((i) => i.kind === 'phone') ? '<div class="foot" style="margin-top:8px">Please check the phone and IMEI before leaving the shop.</div>' : '';
  return page(paper, `${shopHead(s, 'Invoice ' + sale.invoiceNo)}
    <div class="meta"><span>Date</span><b>${esc(Fmt.date(sale.date, 'en', true))}</b></div>
    ${d.party ? `<div class="meta"><span>Customer</span><b>${esc(d.party.name)}</b></div>${d.party.phone ? `<div class="meta"><span>Phone</span><b>${esc(d.party.phone)}</b></div>` : ''}` : ''}
    <hr/>${items}
    <div class="sum">${sum.join('')}</div>
    <div class="grand"><span>Total</span><span>${m(payable)}</span></div>
    <div class="sum">${line('Paid', m(sale.paid), 'paid')}${sale.due > 0 ? line('<b>Balance due</b>', `<span class="due">${m(sale.due)}</span>`) : ''}</div>
    ${sched}${phoneNote}${foot(s)}`);
}

export function statementHtml(p: Party, rows: LedgerEntry[], s: Settings, paper: Paper = 'a4'): string {
  const m = (n: number) => Fmt.money(n, s.currency);
  const th = isThermal(paper);
  const body = th
    ? rows.map((r) => `<div class="row"><div class="l">${esc(Fmt.date(r.date, 'en', true))} · ${esc(r.label)}<div class="sub">${r.debit ? 'Bill ' + m(r.debit) : ''}${r.credit ? 'Paid ' + m(r.credit) : ''}</div></div><div class="r">${m(r.balance)}</div></div>`).join('')
    : `<div class="cols"><div style="width:90px">Date</div><div style="flex:1">Detail</div><div style="width:90px;text-align:right">Bill</div><div style="width:90px;text-align:right">Paid</div><div style="width:100px;text-align:right">Balance</div></div>` +
      rows.map((r) => `<div class="row"><div style="width:90px">${esc(Fmt.date(r.date, 'en', true))}</div><div class="l">${esc(r.label)}</div><div style="width:90px;text-align:right">${r.debit ? m(r.debit) : ''}</div><div style="width:90px;text-align:right">${r.credit ? m(r.credit) : ''}</div><div style="width:100px;text-align:right;font-weight:600">${m(r.balance)}</div></div>`).join('');
  return page(paper, `${shopHead(s, 'Account statement')}<div class="meta"><span>Account</span><b>${esc(p.name)}</b></div>${p.phone ? `<div class="meta"><span>Phone</span><b>${esc(p.phone)}</b></div>` : ''}<hr/>${body}
    <div class="grand"><span>${p.balance >= 0 ? 'They owe you' : 'You owe them'}</span><span>${m(Math.abs(p.balance))}</span></div>${foot(s)}`);
}

export async function labelsHtml(items: { qr: string; title: string; sub: string; price: number }[], s: Settings, paper: Paper = 'a4'): Promise<string> {
  const th = isThermal(paper);
  const cells = await Promise.all(items.map(async (i) => {
    const svg = await qrSvg(i.qr);
    return `<div class="lab"><div class="q">${svg}</div><div class="t"><b>${esc(i.title)}</b><div class="sub">${esc(i.sub)}</div><b>${esc(Fmt.money(i.price, s.currency))}</b></div></div>`;
  }));
  const w = paper === 'a4' ? '62mm' : '100%';
  const extra = `.lab{display:flex;gap:6px;align-items:center;width:${w};padding:4px;border:1px dashed #cbd5e1;margin:${th ? '0 0 3mm' : '3px'};page-break-inside:avoid;${th ? '' : 'float:left;'}font-size:9px}.q{width:${th ? '18mm' : '20mm'};height:${th ? '18mm' : '20mm'};flex:none}.q svg{width:100%;height:100%}.t{overflow:hidden;min-width:0}`;
  return page(paper, cells.join(''), extra);
}

export const phoneLabel = (p: Phone) => ({ qr: p.qr, title: `${p.brand} ${p.model}`, sub: `${p.storage ? p.storage + ' · ' : ''}IMEI ${p.imei1}`, price: p.price });
export const accessoryLabel = (a: Accessory) => ({ qr: a.qr, title: a.name, sub: a.sku || a.category, price: a.price });
