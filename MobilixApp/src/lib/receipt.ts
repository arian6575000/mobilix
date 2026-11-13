// HTML for receipts, statements and QR labels. Printed or turned into a PDF with expo-print; works for A4 and for 58 / 80 mm thermal paper.
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Accessory, Party, LedgerEntry, Phone, SaleDetail, Settings } from '../db/types';
import { Fmt } from './format';
import { CREDIT } from './brand';
import { qrSvg } from './qr';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export type Paper = 'a4' | 58 | 80;

const css = (paper: Paper) => {
  const thermal = paper !== 'a4';
  return `
  *{box-sizing:border-box} body{font-family:-apple-system,Roboto,Arial,sans-serif;color:#0f172a;margin:0;padding:${thermal ? '4px' : '24px'};font-size:${thermal ? '11px' : '13px'};${thermal ? `width:${paper === 58 ? '48mm' : '72mm'};` : ''}}
  h1{font-size:${thermal ? '15px' : '22px'};margin:0 0 2px;text-align:${thermal ? 'center' : 'left'}} .muted{color:#64748b} .c{text-align:center}
  table{width:100%;border-collapse:collapse;margin:8px 0} th{text-align:left;font-size:${thermal ? '10px' : '11px'};color:#64748b;border-bottom:1px solid #cbd5e1;padding:4px 2px}
  td{padding:4px 2px;border-bottom:1px solid #e5e7eb;vertical-align:top} .r{text-align:right} .tot td{border-bottom:none;font-weight:700}
  .big{font-size:${thermal ? '13px' : '16px'};font-weight:700} hr{border:0;border-top:1px dashed #94a3b8;margin:8px 0} .foot{margin-top:12px;text-align:center;font-size:10px;color:#64748b}`;
};
const page = (paper: Paper, body: string) => `<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><style>${css(paper)}</style></head><body>${body}</body></html>`;

function shopHead(s: Settings, title: string) {
  return `<h1>${esc(s.shopName || 'Mobilix')}</h1><div class="${'muted c'}">${esc([s.address, s.phone].filter(Boolean).join(' · '))}</div><hr/><div class="big c">${esc(title)}</div>`;
}
const foot = (s: Settings) => `<div class="foot">${esc(s.receiptFooter)}<br/>Developed by ${esc(CREDIT)}</div>`;

export function saleReceiptHtml(d: SaleDetail, s: Settings, paper: Paper): string {
  const m = (n: number) => Fmt.money(n, s.currency);
  const rows = d.items.map((i) => `<tr><td>${esc(i.label)}${i.sub ? `<br/><span class="muted">${esc(i.sub)}</span>` : ''}</td><td class="r">${i.qty}</td><td class="r">${m(i.price * i.qty)}</td></tr>`).join('');
  const sale = d.sale;
  const sched = d.installments.length
    ? `<hr/><div class="big">Installments</div><table><tr><th>#</th><th>Due</th><th class="r">Amount</th><th class="r">Paid</th></tr>${d.installments.map((i) => `<tr><td>${i.seq}</td><td>${esc(Fmt.date(i.dueDate, 'en', true))}</td><td class="r">${m(i.amount)}</td><td class="r">${m(i.paid)}</td></tr>`).join('')}</table>` : '';
  return page(paper, `${shopHead(s, 'Invoice ' + sale.invoiceNo)}
    <table><tr><td class="muted">Date</td><td class="r">${esc(Fmt.date(sale.date, 'en', true))}</td></tr>
    ${d.party ? `<tr><td class="muted">Customer</td><td class="r">${esc(d.party.name)}${d.party.phone ? '<br/>' + esc(d.party.phone) : ''}</td></tr>` : ''}</table>
    <table><tr><th>Item</th><th class="r">Qty</th><th class="r">Amount</th></tr>${rows}
    ${sale.discount ? `<tr class="tot"><td colspan="2" class="r muted">Discount</td><td class="r">-${m(sale.discount)}</td></tr>` : ''}
    ${sale.markup ? `<tr class="tot"><td colspan="2" class="r muted">Installment charges</td><td class="r">${m(sale.markup)}</td></tr>` : ''}
    <tr class="tot"><td colspan="2" class="r">Total</td><td class="r">${m(sale.total)}</td></tr>
    ${sale.exchangeValue ? `<tr class="tot"><td colspan="2" class="r muted">Trade-in${d.exchangePhone ? ' (' + esc(d.exchangePhone.brand + ' ' + d.exchangePhone.model) + ')' : ''}</td><td class="r">-${m(sale.exchangeValue)}</td></tr>` : ''}
    <tr class="tot"><td colspan="2" class="r">Paid</td><td class="r">${m(sale.paid)}</td></tr>
    <tr class="tot"><td colspan="2" class="r">Balance due</td><td class="r">${m(Math.max(0, sale.due))}</td></tr></table>${sched}
    ${d.items.some((i) => i.kind === 'phone') ? '<div class="muted">Please check the phone and IMEI before leaving the shop.</div>' : ''}${foot(s)}`);
}

export function statementHtml(p: Party, rows: LedgerEntry[], s: Settings, paper: Paper = 'a4'): string {
  const m = (n: number) => (n ? Fmt.money(n, s.currency) : '');
  return page(paper, `${shopHead(s, 'Account statement')}<div><b>${esc(p.name)}</b> ${esc(p.phone)}</div>
    <table><tr><th>Date</th><th>Detail</th><th class="r">Bill</th><th class="r">Paid</th><th class="r">Balance</th></tr>
    ${rows.map((r) => `<tr><td>${esc(Fmt.date(r.date, 'en', true))}</td><td>${esc(r.label)}</td><td class="r">${m(r.debit)}</td><td class="r">${m(r.credit)}</td><td class="r">${Fmt.money(r.balance, s.currency)}</td></tr>`).join('')}
    <tr class="tot"><td colspan="4" class="r">${p.balance >= 0 ? 'They owe you' : 'You owe them'}</td><td class="r">${Fmt.money(Math.abs(p.balance), s.currency)}</td></tr></table>${foot(s)}`);
}

export async function labelsHtml(items: { qr: string; title: string; sub: string; price: number }[], s: Settings, paper: Paper = 'a4'): Promise<string> {
  const cells = await Promise.all(items.map(async (i) => {
    const svg = await qrSvg(i.qr);
    return `<div class="lab"><div class="q">${svg}</div><div class="t"><b>${esc(i.title)}</b><br/><span class="muted">${esc(i.sub)}</span><br/><b>${esc(Fmt.money(i.price, s.currency))}</b></div></div>`;
  }));
  const w = paper === 'a4' ? '62mm' : paper === 58 ? '46mm' : '70mm';
  const extra = `.lab{display:flex;gap:6px;align-items:center;width:${w};padding:4px;border:1px dashed #cbd5e1;margin:3px;page-break-inside:avoid;float:left;font-size:9px}.q{width:20mm;height:20mm;flex:none}.q svg{width:100%;height:100%}.t{overflow:hidden}`;
  return `<html><head><meta charset="utf-8"/><style>${css(paper)}${extra}</style></head><body>${cells.join('')}</body></html>`;
}

export const phoneLabel = (p: Phone) => ({ qr: p.qr, title: `${p.brand} ${p.model}`, sub: `${p.storage ? p.storage + ' · ' : ''}IMEI ${p.imei1}`, price: p.price });
export const accessoryLabel = (a: Accessory) => ({ qr: a.qr, title: a.name, sub: a.sku || a.category, price: a.price });

/** Opens the system print dialog (choose a printer, or "Save as PDF"). */
export async function printHtml(html: string, paper: Paper) {
  const width = paper === 'a4' ? undefined : paper === 58 ? 164 : 227; // points ≈ 58 / 80 mm
  await Print.printAsync({ html, ...(width ? { width } : {}) });
}
/** Makes a PDF and opens the share sheet (WhatsApp, Drive, ...). */
export async function shareHtmlPdf(html: string, paper: Paper) {
  const width = paper === 'a4' ? undefined : paper === 58 ? 164 : 227;
  const { uri } = await Print.printToFileAsync({ html, ...(width ? { width } : {}) });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
