// Mobilix data layer.
//
// Money model (one rule everywhere):
//   party balance = sales billed (total - exchange credit) - purchases billed - payments in + payments out
//   > 0  the party owes us (customer),  < 0  we owe the party (supplier).
// Payments are the only record of money moving; nothing stores a separate "paid" figure.
import type { Db } from './schema';
import { migrate } from './schema';
import {
  Accessory, AccessoryInput, Account, AccountType, Branch, Dashboard, DEFAULT_SETTINGS, Doc, DueRow, Expense, InstallmentRow, LedgerEntry,
  Party, PartyInput, Phone, PhoneDraft, PhoneStatus, PurchaseInput, Report, SaleDetail, SaleInput, SaleRow, Settings,
} from './types';
import { todayStr } from '../lib/dates';
import { allocate, buildSchedule } from '../lib/installments';

let db: Db;
export async function initRepo(d: Db) { db = d; await migrate(d); await ensureDefaults(); }
export const getDb = () => db;

const num = (v: any) => Number(v) || 0;
const r2 = (n: number) => Math.round(n * 100) / 100;
const parseJson = <T,>(s: any, fallback: T): T => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };
const rid = () => Math.random().toString(36).slice(2, 10);
const like = (q: string) => `%${q.trim().replace(/[%_]/g, '')}%`;

// ---------------------------------------------------------------- row mappers
const toBranch = (r: any): Branch => ({ id: r.id, name: r.name, address: r.address || '', phone: r.phone || '', isDefault: !!r.is_default });
const toAccount = (r: any): Account => ({ id: r.id, branchId: r.branch_id, name: r.name, type: r.type, opening: num(r.opening), balance: num(r.balance), isActive: !!r.is_active });
const toParty = (r: any): Party => ({ id: r.id, kind: r.kind, name: r.name, phone: r.phone || '', cnic: r.cnic || '', address: r.address || '', notes: r.notes || '', balance: r2(num(r.balance)) });
const toPhone = (r: any): Phone => ({
  id: r.id, branchId: r.branch_id, brand: r.brand, model: r.model, storage: r.storage || '', ram: r.ram || '', color: r.color || '',
  condition: r.condition, grade: r.grade || '', pta: r.pta, battery: r.battery ?? null, imei1: r.imei1, imei2: r.imei2 || '',
  cost: num(r.cost), price: num(r.price), status: r.status, qr: r.qr, notes: r.notes || '', createdAt: r.created_at,
});
const toAccessory = (r: any): Accessory => ({
  id: r.id, branchId: r.branch_id, name: r.name, category: r.category || '', sku: r.sku || '', qr: r.qr,
  qty: num(r.qty), minQty: num(r.min_qty), cost: num(r.cost), price: num(r.price),
});
const toDoc = (r: any): Doc => ({ id: r.id, ownerType: r.owner_type, ownerId: r.owner_id, label: r.label || '', file: r.file, createdAt: r.created_at });
const toInstallment = (r: any): InstallmentRow => ({ id: r.id, planId: r.plan_id, seq: r.seq, dueDate: r.due_date, amount: num(r.amount), paid: num(r.paid), paidAt: r.paid_at || '' });

const PARTY_BALANCE = `(
  COALESCE((SELECT SUM(s.total - s.exchange_value) FROM sales s WHERE s.party_id = p.id), 0)
  - COALESCE((SELECT SUM(u.total) FROM purchases u WHERE u.party_id = p.id), 0)
  - COALESCE((SELECT SUM(CASE WHEN y.direction = 'in' THEN y.amount ELSE -y.amount END) FROM payments y WHERE y.party_id = p.id), 0)
)`;

/** A fresh install always has one branch and one Cash account so every sale / payment has somewhere to go. */
async function ensureDefaults() {
  const b = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM branches');
  if (num(b?.n) > 0) return;
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    const r = await db.runAsync('INSERT INTO branches (name, is_default, created_at) VALUES (?, 1, ?)', ['Main Branch', now]);
    await db.runAsync('INSERT INTO accounts (branch_id, name, type, opening, created_at) VALUES (?, ?, ?, 0, ?)', [r.lastInsertRowId, 'Cash', 'cash', now]);
  });
}

// ---------------------------------------------------------------- validation helpers
const IMEI = /^\d{15}$/;
function checkDraft(d: PhoneDraft) {
  if (!d.brand?.trim() || !d.model?.trim()) throw new Error('Brand and model are required');
  if (!IMEI.test((d.imei1 || '').trim())) throw new Error('IMEI 1 must be exactly 15 digits');
  if (d.imei2?.trim() && !IMEI.test(d.imei2.trim())) throw new Error('IMEI 2 must be exactly 15 digits');
  if (d.imei2?.trim() && d.imei2.trim() === d.imei1.trim()) throw new Error('IMEI 1 and IMEI 2 are the same');
  if (!(num(d.cost) >= 0) || !(num(d.price) >= 0)) throw new Error('Cost and price cannot be negative');
}
async function assertImeiFree(d: PhoneDraft) {
  for (const imei of [d.imei1.trim(), (d.imei2 || '').trim()].filter(Boolean)) {
    const hit = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM phones WHERE (imei1 = ? OR imei2 = ?) AND status IN ('in_stock','repair','transit') LIMIT 1", [imei, imei]);
    if (hit) throw new Error(`IMEI ${imei} is already in stock`);
  }
}
async function insertPhone(d: PhoneDraft, branchId: number, purchaseId: number | null, status: PhoneStatus = 'in_stock'): Promise<number> {
  const now = Date.now();
  const r = await db.runAsync(
    `INSERT INTO phones (branch_id, brand, model, storage, ram, color, condition, grade, pta, battery, imei1, imei2, cost, price, status, qr, notes, purchase_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [branchId, d.brand.trim(), d.model.trim(), d.storage || '', d.ram || '', d.color || '', d.condition, d.grade || '', d.pta || 'unknown', d.battery ?? null,
      d.imei1.trim(), (d.imei2 || '').trim(), r2(num(d.cost)), r2(num(d.price)), status, `tmp:${rid()}`, d.notes || '', purchaseId, now, now]);
  await db.runAsync('UPDATE phones SET qr = ? WHERE id = ?', [`MBX:P:${r.lastInsertRowId}`, r.lastInsertRowId]);
  return r.lastInsertRowId;
}
async function insertAccessory(branchId: number, a: AccessoryInput): Promise<number> {
  if (!a.name?.trim()) throw new Error('Item name is required');
  if (!(num(a.cost) >= 0) || !(num(a.price) >= 0)) throw new Error('Cost and price cannot be negative');
  const r = await db.runAsync(
    'INSERT INTO accessories (branch_id, name, category, sku, qr, qty, min_qty, cost, price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [branchId, a.name.trim(), a.category || '', a.sku || '', `tmp:${rid()}`, num(a.qty), num(a.minQty), r2(num(a.cost)), r2(num(a.price)), Date.now()]);
  await db.runAsync('UPDATE accessories SET qr = ? WHERE id = ?', [`MBX:A:${r.lastInsertRowId}`, r.lastInsertRowId]);
  return r.lastInsertRowId;
}
async function insertPayment(p: { branchId: number; accountId: number; partyId: number | null; saleId?: number | null; purchaseId?: number | null; installmentId?: number | null; direction: 'in' | 'out'; amount: number; date: string; note?: string }) {
  const r = await db.runAsync(
    'INSERT INTO payments (branch_id, account_id, party_id, sale_id, purchase_id, installment_id, direction, amount, date, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [p.branchId, p.accountId, p.partyId, p.saleId ?? null, p.purchaseId ?? null, p.installmentId ?? null, p.direction, r2(p.amount), p.date, p.note || '', Date.now()]);
  return r.lastInsertRowId;
}
async function accountBranch(accountId: number | null): Promise<number> {
  const a = accountId ? await db.getFirstAsync<{ branch_id: number }>('SELECT branch_id FROM accounts WHERE id = ?', [accountId]) : null;
  if (!a) throw new Error('Choose the account the money goes through');
  return a.branch_id;
}

export const Repo = {
  // ================================================================ Settings
  async getSettings(): Promise<Settings> {
    const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM settings WHERE id = ?', ['main']);
    if (!row) { await db.runAsync('INSERT INTO settings (id, data) VALUES (?, ?)', ['main', JSON.stringify(DEFAULT_SETTINGS)]); return { ...DEFAULT_SETTINGS }; }
    return { ...DEFAULT_SETTINGS, ...parseJson<Partial<Settings>>(row.data, {}) };
  },
  async saveSettings(s: Settings): Promise<Settings> {
    await db.runAsync('INSERT OR REPLACE INTO settings (id, data) VALUES (?, ?)', ['main', JSON.stringify(s)]);
    return s;
  },

  // ================================================================ Branches & accounts
  async listBranches(): Promise<Branch[]> {
    return (await db.getAllAsync<any>('SELECT * FROM branches ORDER BY is_default DESC, id')).map(toBranch);
  },
  async defaultBranchId(): Promise<number> {
    const r = await db.getFirstAsync<{ id: number }>('SELECT id FROM branches ORDER BY is_default DESC, id LIMIT 1');
    return r!.id;
  },
  async addBranch(name: string, address = '', phone = ''): Promise<number> {
    const nm = name.trim();
    if (!nm) throw new Error('Branch name is required');
    const now = Date.now();
    let id = 0;
    await db.withTransactionAsync(async () => {
      const r = await db.runAsync('INSERT INTO branches (name, address, phone, created_at) VALUES (?, ?, ?, ?)', [nm, address, phone, now]);
      id = r.lastInsertRowId;
      await db.runAsync('INSERT INTO accounts (branch_id, name, type, opening, created_at) VALUES (?, ?, ?, 0, ?)', [id, 'Cash', 'cash', now]);
    });
    return id;
  },
  /** Balance = opening + payments in - payments out - expenses + transfers in - transfers out. */
  async listAccounts(branchId: number | null = null): Promise<Account[]> {
    const rows = await db.getAllAsync<any>(
      `SELECT a.*,
         a.opening
         + COALESCE((SELECT SUM(CASE WHEN p.direction = 'in' THEN p.amount ELSE -p.amount END) FROM payments p WHERE p.account_id = a.id), 0)
         - COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.account_id = a.id), 0)
         + COALESCE((SELECT SUM(t.amount) FROM transfers t WHERE t.to_account_id = a.id), 0)
         - COALESCE((SELECT SUM(t.amount) FROM transfers t WHERE t.from_account_id = a.id), 0) AS balance
       FROM accounts a WHERE (? IS NULL OR a.branch_id = ?) ORDER BY a.branch_id, a.id`,
      [branchId, branchId],
    );
    return rows.map(toAccount);
  },
  async addAccount(branchId: number, name: string, type: AccountType, opening = 0): Promise<number> {
    const nm = name.trim();
    if (!nm) throw new Error('Account name is required');
    const r = await db.runAsync('INSERT INTO accounts (branch_id, name, type, opening, created_at) VALUES (?, ?, ?, ?, ?)', [branchId, nm, type, opening, Date.now()]);
    return r.lastInsertRowId;
  },
  async addTransfer(fromId: number, toId: number, amount: number, date: string, note = '') {
    if (fromId === toId) throw new Error('Choose two different accounts');
    if (!(amount > 0)) throw new Error('Enter a valid amount');
    await db.runAsync('INSERT INTO transfers (from_account_id, to_account_id, amount, date, note, created_at) VALUES (?, ?, ?, ?, ?, ?)', [fromId, toId, r2(amount), date, note, Date.now()]);
  },

  // ================================================================ Parties
  async listParties(o: { kind?: 'customer' | 'supplier'; q?: string } = {}): Promise<Party[]> {
    const where: string[] = []; const params: any[] = [];
    if (o.kind) { where.push("(p.kind = ? OR p.kind = 'both')"); params.push(o.kind); }
    if (o.q?.trim()) { where.push('(p.name LIKE ? OR p.phone LIKE ? OR p.cnic LIKE ?)'); params.push(like(o.q), like(o.q), like(o.q)); }
    const rows = await db.getAllAsync<any>(
      `SELECT p.*, ${PARTY_BALANCE} AS balance FROM parties p ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.name COLLATE NOCASE`, params);
    return rows.map(toParty);
  },
  async getParty(id: number): Promise<Party | null> {
    const r = await db.getFirstAsync<any>(`SELECT p.*, ${PARTY_BALANCE} AS balance FROM parties p WHERE p.id = ?`, [id]);
    return r ? toParty(r) : null;
  },
  async saveParty(input: PartyInput, id?: number): Promise<number> {
    const name = input.name.trim();
    if (!name) throw new Error('Name is required');
    const v = [input.kind, name, input.phone?.trim() || '', input.cnic?.trim() || '', input.address?.trim() || '', input.notes?.trim() || ''];
    if (id) { await db.runAsync('UPDATE parties SET kind = ?, name = ?, phone = ?, cnic = ?, address = ?, notes = ? WHERE id = ?', [...v, id]); return id; }
    return (await db.runAsync('INSERT INTO parties (kind, name, phone, cnic, address, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [...v, Date.now()])).lastInsertRowId;
  },
  async deleteParty(id: number) {
    const used = await db.getFirstAsync<{ n: number }>(
      'SELECT (SELECT COUNT(*) FROM sales WHERE party_id = ?) + (SELECT COUNT(*) FROM purchases WHERE party_id = ?) + (SELECT COUNT(*) FROM payments WHERE party_id = ?) AS n', [id, id, id]);
    if (num(used?.n) > 0) throw new Error('This party has sales, purchases or payments and cannot be deleted');
    await db.runAsync('DELETE FROM parties WHERE id = ?', [id]);
  },
  /** Statement: every bill and payment with a running balance (positive = they owe us). */
  async partyLedger(partyId: number): Promise<LedgerEntry[]> {
    const rows = await db.getAllAsync<any>(
      `SELECT date, type, label, debit, credit, ref_id, created_at FROM (
         SELECT date, 'sale' AS type, invoice_no AS label, total - exchange_value AS debit, 0 AS credit, id AS ref_id, created_at FROM sales WHERE party_id = ?
         UNION ALL SELECT date, 'purchase', 'Purchase #' || id, 0, total, id, created_at FROM purchases WHERE party_id = ?
         UNION ALL SELECT date, CASE direction WHEN 'in' THEN 'payment_in' ELSE 'payment_out' END, COALESCE(NULLIF(note, ''), 'Payment'),
                CASE direction WHEN 'out' THEN amount ELSE 0 END, CASE direction WHEN 'in' THEN amount ELSE 0 END, id, created_at FROM payments WHERE party_id = ?
       ) ORDER BY date, created_at, ref_id`, [partyId, partyId, partyId]);
    let bal = 0;
    return rows.map((r) => { bal = r2(bal + num(r.debit) - num(r.credit)); return { date: r.date, type: r.type, label: r.label, debit: num(r.debit), credit: num(r.credit), balance: bal, refId: r.ref_id }; });
  },
  /** Money in/out against a person. "in" fills their oldest unpaid bills (and installments) first, "out" the oldest unpaid purchases;
   *  anything left over is kept as an advance on their account. */
  async partyPayment(o: { partyId: number; direction: 'in' | 'out'; amount: number; accountId: number; date: string; note?: string }) {
    if (!(o.amount > 0)) throw new Error('Enter a valid amount');
    const branchId = await accountBranch(o.accountId);
    await db.withTransactionAsync(async () => {
      let left = r2(o.amount);
      if (o.direction === 'in') {
        for (const sale of await db.getAllAsync<any>('SELECT id FROM sales WHERE party_id = ? ORDER BY date, id', [o.partyId])) {
          if (left <= 0) break;
          const due = await Repo.saleOutstanding(sale.id);
          if (due <= 0.004) continue;
          const part = Math.min(due, left);
          await applySalePayment(sale.id, o.partyId, part, o.accountId, branchId, o.date, o.note);
          left = r2(left - part);
        }
      } else {
        for (const pu of await db.getAllAsync<any>('SELECT id, total FROM purchases WHERE party_id = ? ORDER BY date, id', [o.partyId])) {
          if (left <= 0) break;
          const paid = num((await db.getFirstAsync<{ v: number }>("SELECT COALESCE(SUM(amount), 0) AS v FROM payments WHERE purchase_id = ? AND direction = 'out'", [pu.id]))?.v);
          const due = r2(num(pu.total) - paid);
          if (due <= 0.004) continue;
          const part = Math.min(due, left);
          await insertPayment({ branchId, accountId: o.accountId, partyId: o.partyId, purchaseId: pu.id, direction: 'out', amount: part, date: o.date, note: o.note });
          left = r2(left - part);
        }
      }
      if (left > 0.004) await insertPayment({ branchId, accountId: o.accountId, partyId: o.partyId, direction: o.direction, amount: left, date: o.date, note: o.note || 'Advance' });
    });
  },

  // ================================================================ Phones
  async listPhones(o: { branchId?: number | null; status?: PhoneStatus | 'all'; condition?: 'new' | 'used'; q?: string } = {}): Promise<Phone[]> {
    const where: string[] = []; const params: any[] = [];
    if (o.branchId) { where.push('branch_id = ?'); params.push(o.branchId); }
    if (o.status && o.status !== 'all') { where.push('status = ?'); params.push(o.status); }
    if (o.condition) { where.push('condition = ?'); params.push(o.condition); }
    if (o.q?.trim()) { where.push('(brand LIKE ? OR model LIKE ? OR imei1 LIKE ? OR imei2 LIKE ? OR color LIKE ?)'); const l = like(o.q); params.push(l, l, l, l, l); }
    return (await db.getAllAsync<any>(`SELECT * FROM phones ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC, id DESC LIMIT 500`, params)).map(toPhone);
  },
  async getPhone(id: number): Promise<Phone | null> {
    const r = await db.getFirstAsync<any>('SELECT * FROM phones WHERE id = ?', [id]);
    return r ? toPhone(r) : null;
  },
  async updatePhone(id: number, patch: Partial<Pick<Phone, 'price' | 'cost' | 'color' | 'grade' | 'pta' | 'battery' | 'notes' | 'status'>>) {
    const cur = await Repo.getPhone(id);
    if (!cur) throw new Error('Phone not found');
    if (cur.status === 'sold' && patch.status && patch.status !== 'sold') throw new Error('A sold phone cannot be moved back by hand');
    const n = { ...cur, ...patch };
    if (!(n.price >= 0) || !(n.cost >= 0)) throw new Error('Cost and price cannot be negative');
    await db.runAsync('UPDATE phones SET price = ?, cost = ?, color = ?, grade = ?, pta = ?, battery = ?, notes = ?, status = ?, updated_at = ? WHERE id = ?',
      [r2(n.price), r2(n.cost), n.color, n.grade, n.pta, n.battery, n.notes, n.status, Date.now(), id]);
  },
  async transferPhone(id: number, toBranchId: number) {
    const cur = await Repo.getPhone(id);
    if (!cur || cur.status !== 'in_stock') throw new Error('Only phones in stock can be transferred');
    await db.runAsync('UPDATE phones SET branch_id = ?, updated_at = ? WHERE id = ?', [toBranchId, Date.now(), id]);
  },
  /** Which sale a sold phone left on. */
  async saleOfPhone(phoneId: number): Promise<{ saleId: number; invoiceNo: string } | null> {
    const r = await db.getFirstAsync<any>('SELECT s.id, s.invoice_no FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE si.phone_id = ? ORDER BY s.id DESC LIMIT 1', [phoneId]);
    return r ? { saleId: r.id, invoiceNo: r.invoice_no } : null;
  },
  /** Scanner / search box: our QR ("MBX:P:12" / "MBX:A:7"), an IMEI, or an accessory SKU. */
  async resolveScan(code: string): Promise<{ type: 'phone'; phone: Phone } | { type: 'accessory'; accessory: Accessory } | null> {
    const c = code.trim();
    const m = /^MBX:([PA]):(\d+)$/.exec(c);
    if (m) {
      if (m[1] === 'P') { const p = await Repo.getPhone(Number(m[2])); return p ? { type: 'phone', phone: p } : null; }
      const a = await Repo.getAccessory(Number(m[2])); return a ? { type: 'accessory', accessory: a } : null;
    }
    const p = await db.getFirstAsync<any>('SELECT * FROM phones WHERE (imei1 = ? OR imei2 = ?) ORDER BY (status = \'in_stock\') DESC, id DESC LIMIT 1', [c, c]);
    if (p) return { type: 'phone', phone: toPhone(p) };
    const a = c ? await db.getFirstAsync<any>('SELECT * FROM accessories WHERE sku = ? AND sku <> \'\' LIMIT 1', [c]) : null;
    return a ? { type: 'accessory', accessory: toAccessory(a) } : null;
  },

  // ================================================================ Accessories
  async listAccessories(o: { branchId?: number | null; q?: string } = {}): Promise<Accessory[]> {
    const where: string[] = []; const params: any[] = [];
    if (o.branchId) { where.push('branch_id = ?'); params.push(o.branchId); }
    if (o.q?.trim()) { where.push('(name LIKE ? OR category LIKE ? OR sku LIKE ?)'); const l = like(o.q); params.push(l, l, l); }
    return (await db.getAllAsync<any>(`SELECT * FROM accessories ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY name COLLATE NOCASE`, params)).map(toAccessory);
  },
  async getAccessory(id: number): Promise<Accessory | null> {
    const r = await db.getFirstAsync<any>('SELECT * FROM accessories WHERE id = ?', [id]);
    return r ? toAccessory(r) : null;
  },
  async addAccessory(branchId: number, a: AccessoryInput): Promise<number> { return insertAccessory(branchId, a); },
  async updateAccessory(id: number, a: Partial<AccessoryInput>) {
    const cur = await Repo.getAccessory(id);
    if (!cur) throw new Error('Item not found');
    const n = { ...cur, ...a };
    if (!n.name.trim()) throw new Error('Item name is required');
    await db.runAsync('UPDATE accessories SET name = ?, category = ?, sku = ?, min_qty = ?, cost = ?, price = ? WHERE id = ?',
      [n.name.trim(), n.category || '', n.sku || '', num(n.minQty), r2(num(n.cost)), r2(num(n.price)), id]);
  },
  /** Stock count correction (damage, recount). Negative result is refused. */
  async adjustAccessory(id: number, delta: number) {
    const cur = await Repo.getAccessory(id);
    if (!cur) throw new Error('Item not found');
    if (cur.qty + delta < 0) throw new Error('Quantity cannot go below zero');
    await db.runAsync('UPDATE accessories SET qty = ? WHERE id = ?', [cur.qty + delta, id]);
  },

  // ================================================================ Purchase
  async createPurchase(i: PurchaseInput): Promise<number> {
    if (!i.phones.length && !i.accessories.length) throw new Error('Add at least one item');
    i.phones.forEach(checkDraft);
    const seen = new Set<string>();
    for (const d of i.phones) {
      for (const x of [d.imei1.trim(), (d.imei2 || '').trim()].filter(Boolean)) { if (seen.has(x)) throw new Error(`IMEI ${x} is entered twice`); seen.add(x); }
      await assertImeiFree(d);
    }
    for (const a of i.accessories) if (!(a.qty > 0) || !(a.cost >= 0)) throw new Error('Accessory quantity and cost must be valid');
    const total = r2(i.phones.reduce((s, d) => s + num(d.cost), 0) + i.accessories.reduce((s, a) => s + a.qty * a.cost, 0));
    const paid = r2(num(i.paid));
    if (paid < 0 || paid > total) throw new Error('Paid amount cannot be more than the total');
    if (paid > 0) await accountBranch(i.accountId);
    if (total - paid > 0 && !i.partyId) throw new Error('Choose the supplier to keep an unpaid balance');
    let id = 0;
    await db.withTransactionAsync(async () => {
      id = (await db.runAsync('INSERT INTO purchases (branch_id, party_id, date, total, note, created_at) VALUES (?, ?, ?, ?, ?, ?)', [i.branchId, i.partyId, i.date, total, i.note || '', Date.now()])).lastInsertRowId;
      for (const d of i.phones) {
        const pid = await insertPhone(d, i.branchId, id);
        await db.runAsync("INSERT INTO purchase_items (purchase_id, kind, phone_id, qty, cost) VALUES (?, 'phone', ?, 1, ?)", [id, pid, r2(num(d.cost))]);
      }
      for (const a of i.accessories) {
        await db.runAsync("INSERT INTO purchase_items (purchase_id, kind, accessory_id, qty, cost) VALUES (?, 'accessory', ?, ?, ?)", [id, a.accessoryId, a.qty, a.cost]);
        await db.runAsync('UPDATE accessories SET qty = qty + ?, cost = ? WHERE id = ?', [a.qty, r2(a.cost), a.accessoryId]);
      }
      if (paid > 0) await insertPayment({ branchId: i.branchId, accountId: i.accountId!, partyId: i.partyId, purchaseId: id, direction: 'out', amount: paid, date: i.date });
    });
    return id;
  },
  async listPurchases(o: { branchId?: number | null; limit?: number } = {}) {
    const rows = await db.getAllAsync<any>(
      `SELECT u.*, p.name AS party_name,
         u.total - COALESCE((SELECT SUM(amount) FROM payments y WHERE y.purchase_id = u.id AND y.direction = 'out'), 0) AS due
       FROM purchases u LEFT JOIN parties p ON p.id = u.party_id WHERE (? IS NULL OR u.branch_id = ?) ORDER BY u.date DESC, u.id DESC LIMIT ?`,
      [o.branchId ?? null, o.branchId ?? null, o.limit ?? 200]);
    return rows.map((r) => ({ id: r.id as number, date: r.date as string, partyId: r.party_id as number | null, partyName: (r.party_name || '') as string, total: num(r.total), due: r2(num(r.due)) }));
  },

  // ================================================================ Sales
  async createSale(i: SaleInput): Promise<number> {
    if (!i.items.length) throw new Error('Add at least one item');
    const phoneIds = new Set<number>();
    let subtotal = 0;
    const costs: number[] = [];
    for (const line of i.items) {
      if (line.kind === 'phone') {
        if (phoneIds.has(line.phoneId)) throw new Error('The same phone is added twice');
        phoneIds.add(line.phoneId);
        const p = await Repo.getPhone(line.phoneId);
        if (!p) throw new Error('Phone not found');
        if (p.status !== 'in_stock') throw new Error(`${p.brand} ${p.model} (${p.imei1}) is not in stock`);
        if (p.branchId !== i.branchId) throw new Error(`${p.brand} ${p.model} is in another branch`);
        if (!(line.price >= 0)) throw new Error('Price cannot be negative');
        subtotal += line.price; costs.push(p.cost);
      } else {
        const a = await Repo.getAccessory(line.accessoryId);
        if (!a) throw new Error('Item not found');
        if (!(line.qty > 0)) throw new Error('Quantity must be more than zero');
        if (a.qty < line.qty) throw new Error(`Only ${a.qty} of ${a.name} in stock`);
        if (!(line.price >= 0)) throw new Error('Price cannot be negative');
        subtotal += line.qty * line.price; costs.push(a.cost);
      }
    }
    subtotal = r2(subtotal);
    const discount = r2(num(i.discount));
    if (discount < 0 || discount > subtotal) throw new Error('Discount cannot be more than the bill');
    const markup = i.kind === 'installment' ? r2(num(i.plan?.markup)) : 0;
    if (markup < 0) throw new Error('Markup cannot be negative');
    const total = r2(subtotal - discount + markup);
    const exchangeValue = i.exchange ? r2(num(i.exchange.value)) : 0;
    if (i.exchange) { checkDraft(i.exchange); await assertImeiFree(i.exchange); }
    if (exchangeValue < 0 || exchangeValue > total) throw new Error('Trade-in value cannot be more than the bill');
    if (i.exchange && i.items.some((l) => l.kind === 'phone' && phoneIds.has(l.phoneId))) {
      const sold = await Promise.all([...phoneIds].map((id) => Repo.getPhone(id)));
      if (sold.some((p) => p && (p.imei1 === i.exchange!.imei1.trim() || (p.imei2 && p.imei2 === i.exchange!.imei1.trim())))) throw new Error('The trade-in IMEI matches a phone in this sale');
    }
    const net = r2(total - exchangeValue);

    let paid = r2(num(i.paid));
    if (i.kind === 'cash') paid = net;
    if (paid < 0 || paid > net) throw new Error('Paid amount cannot be more than the bill');
    if (i.kind !== 'cash' && !i.partyId) throw new Error('Choose the customer for a credit or installment sale');
    if (i.kind === 'credit' && paid >= net && net > 0) throw new Error('Nothing is due: use a cash sale');
    if (paid > 0) await accountBranch(i.accountId);
    if (i.kind === 'installment') {
      if (!i.plan) throw new Error('Installment plan is required');
      if (net - paid <= 0) throw new Error('Nothing left to put on installments');
    }
    const schedule = i.kind === 'installment' ? buildSchedule(r2(net - paid), i.plan!.months, i.plan!.firstDue) : [];

    // invoice number: prefix + running number, first free
    const prefix = i.invoicePrefix ?? 'INV-';
    let n = num((await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sales'))?.n) + 1;
    let invoiceNo = '';
    for (;;) {
      invoiceNo = `${prefix}${String(n).padStart(5, '0')}`;
      if (!(await db.getFirstAsync('SELECT 1 AS x FROM sales WHERE invoice_no = ?', [invoiceNo]))) break;
      n++;
    }

    let saleId = 0;
    await db.withTransactionAsync(async () => {
      let exchangeId: number | null = null;
      if (i.exchange) exchangeId = await insertPhone({ ...i.exchange, cost: exchangeValue }, i.branchId, null);
      saleId = (await db.runAsync(
        `INSERT INTO sales (branch_id, invoice_no, party_id, date, kind, discount, markup, total, exchange_phone_id, exchange_value, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [i.branchId, invoiceNo, i.partyId, i.date, i.kind, discount, markup, total, exchangeId, exchangeValue, i.note || '', Date.now()])).lastInsertRowId;
      let k = 0;
      for (const line of i.items) {
        if (line.kind === 'phone') {
          await db.runAsync("INSERT INTO sale_items (sale_id, kind, phone_id, qty, price, cost) VALUES (?, 'phone', ?, 1, ?, ?)", [saleId, line.phoneId, r2(line.price), costs[k]]);
          await db.runAsync("UPDATE phones SET status = 'sold', updated_at = ? WHERE id = ?", [Date.now(), line.phoneId]);
        } else {
          await db.runAsync("INSERT INTO sale_items (sale_id, kind, accessory_id, qty, price, cost) VALUES (?, 'accessory', ?, ?, ?, ?)", [saleId, line.accessoryId, line.qty, r2(line.price), costs[k]]);
          await db.runAsync('UPDATE accessories SET qty = qty - ? WHERE id = ?', [line.qty, line.accessoryId]);
        }
        k++;
      }
      if (paid > 0) await insertPayment({ branchId: i.branchId, accountId: i.accountId!, partyId: i.partyId, saleId, direction: 'in', amount: paid, date: i.date, note: i.kind === 'installment' ? 'Advance' : '' });
      if (i.kind === 'installment') {
        const pl = i.plan!;
        const planId = (await db.runAsync(
          'INSERT INTO installment_plans (sale_id, party_id, advance, months, markup, first_due, guarantor_name, guarantor_phone, guarantor_cnic, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [saleId, i.partyId, paid, pl.months, markup, pl.firstDue, pl.guarantorName || '', pl.guarantorPhone || '', pl.guarantorCnic || '', Date.now()])).lastInsertRowId;
        for (const r of schedule) await db.runAsync('INSERT INTO installments (plan_id, seq, due_date, amount) VALUES (?, ?, ?, ?)', [planId, r.seq, r.dueDate, r.amount]);
      }
    });
    return saleId;
  },

  async saleOutstanding(saleId: number): Promise<number> {
    const r = await db.getFirstAsync<any>(
      `SELECT s.total - s.exchange_value - COALESCE((SELECT SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END) FROM payments WHERE sale_id = s.id), 0) AS due FROM sales s WHERE s.id = ?`, [saleId]);
    return r2(num(r?.due));
  },

  /** Customer pays against one bill. If the bill is on installments the money fills the oldest unpaid installments first. */
  async receiveSalePayment(o: { saleId: number; amount: number; accountId: number; date: string; note?: string }) {
    if (!(o.amount > 0)) throw new Error('Enter a valid amount');
    const sale = await db.getFirstAsync<any>('SELECT * FROM sales WHERE id = ?', [o.saleId]);
    if (!sale) throw new Error('Sale not found');
    const due = await Repo.saleOutstanding(o.saleId);
    if (o.amount > due + 0.001) throw new Error(`Only ${due} is due on this bill`);
    const branchId = await accountBranch(o.accountId);
    await db.withTransactionAsync(async () => { await applySalePayment(o.saleId, sale.party_id, o.amount, o.accountId, branchId, o.date, o.note); });
  },

  async listSales(o: { branchId?: number | null; q?: string; filter?: 'all' | 'credit' | 'installment' | 'due'; limit?: number } = {}): Promise<SaleRow[]> {
    const where: string[] = []; const params: any[] = [];
    if (o.branchId) { where.push('s.branch_id = ?'); params.push(o.branchId); }
    if (o.filter === 'credit') where.push("s.kind = 'credit'");
    if (o.filter === 'installment') where.push("s.kind = 'installment'");
    if (o.q?.trim()) {
      where.push(`(s.invoice_no LIKE ? OR p.name LIKE ? OR p.phone LIKE ? OR EXISTS (SELECT 1 FROM sale_items si JOIN phones ph ON ph.id = si.phone_id WHERE si.sale_id = s.id AND (ph.imei1 LIKE ? OR ph.imei2 LIKE ? OR ph.model LIKE ?)))`);
      const l = like(o.q); params.push(l, l, l, l, l, l);
    }
    const rows = await db.getAllAsync<any>(
      `SELECT s.*, p.name AS party_name,
         COALESCE((SELECT SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END) FROM payments WHERE sale_id = s.id), 0) AS paid,
         (SELECT GROUP_CONCAT(COALESCE(ph.brand || ' ' || ph.model, a.name), ', ') FROM sale_items si LEFT JOIN phones ph ON ph.id = si.phone_id LEFT JOIN accessories a ON a.id = si.accessory_id WHERE si.sale_id = s.id) AS summary
       FROM sales s LEFT JOIN parties p ON p.id = s.party_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY s.date DESC, s.id DESC LIMIT ?`, [...params, o.limit ?? 300]);
    const out: SaleRow[] = rows.map((r) => ({
      id: r.id, invoiceNo: r.invoice_no, date: r.date, kind: r.kind, partyId: r.party_id ?? null, partyName: r.party_name || '', total: num(r.total),
      exchangeValue: num(r.exchange_value), paid: r2(num(r.paid)), due: r2(num(r.total) - num(r.exchange_value) - num(r.paid)), summary: r.summary || '', branchId: r.branch_id,
    }));
    return o.filter === 'due' ? out.filter((s) => s.due > 0.004) : out;
  },

  async getSale(id: number): Promise<SaleDetail | null> {
    const list = await db.getFirstAsync<any>('SELECT * FROM sales WHERE id = ?', [id]);
    if (!list) return null;
    const row = (await Repo.listSales({ q: list.invoice_no, limit: 5 })).find((s) => s.id === id)!;
    const items = (await db.getAllAsync<any>(
      `SELECT si.*, ph.brand, ph.model, ph.storage, ph.color, ph.imei1, a.name AS acc_name FROM sale_items si
       LEFT JOIN phones ph ON ph.id = si.phone_id LEFT JOIN accessories a ON a.id = si.accessory_id WHERE si.sale_id = ? ORDER BY si.id`, [id]))
      .map((r) => ({
        id: r.id, kind: r.kind, label: r.kind === 'phone' ? `${r.brand} ${r.model}${r.storage ? ' ' + r.storage : ''}` : r.acc_name,
        sub: r.kind === 'phone' ? `IMEI ${r.imei1}${r.color ? ' · ' + r.color : ''}` : '', qty: num(r.qty), price: num(r.price), cost: num(r.cost), phoneId: r.phone_id ?? null,
      }));
    const payments = (await db.getAllAsync<any>(
      'SELECT y.*, a.name AS account_name FROM payments y JOIN accounts a ON a.id = y.account_id WHERE y.sale_id = ? ORDER BY y.date, y.id', [id]))
      .map((r) => ({ id: r.id, amount: num(r.amount), date: r.date, accountName: r.account_name, note: r.note || '', direction: r.direction }));
    const pl = await db.getFirstAsync<any>('SELECT * FROM installment_plans WHERE sale_id = ?', [id]);
    const installments = pl ? (await db.getAllAsync<any>('SELECT * FROM installments WHERE plan_id = ? ORDER BY seq', [pl.id])).map(toInstallment) : [];
    return {
      sale: { ...row, discount: num(list.discount), markup: num(list.markup), note: list.note || '' },
      party: list.party_id ? await Repo.getParty(list.party_id) : null,
      items, payments,
      plan: pl ? { id: pl.id, advance: num(pl.advance), months: pl.months, markup: num(pl.markup), firstDue: pl.first_due, guarantorName: pl.guarantor_name || '', guarantorPhone: pl.guarantor_phone || '', guarantorCnic: pl.guarantor_cnic || '' } : null,
      installments,
      exchangePhone: list.exchange_phone_id ? await Repo.getPhone(list.exchange_phone_id) : null,
    };
  },

  /** Unpaid installments due on or before `until` (default: already overdue). */
  async dueInstallments(o: { branchId?: number | null; until?: string } = {}): Promise<DueRow[]> {
    const until = o.until ?? addDay(todayStr(), -1);
    const rows = await db.getAllAsync<any>(
      `SELECT i.*, s.id AS sale_id, s.invoice_no, p.id AS party_id, p.name AS party_name, p.phone AS party_phone
       FROM installments i JOIN installment_plans pl ON pl.id = i.plan_id JOIN sales s ON s.id = pl.sale_id JOIN parties p ON p.id = pl.party_id
       WHERE i.due_date <= ? AND i.paid < i.amount AND (? IS NULL OR s.branch_id = ?) ORDER BY i.due_date, i.seq`, [until, o.branchId ?? null, o.branchId ?? null]);
    return rows.map((r) => ({ ...toInstallment(r), saleId: r.sale_id, invoiceNo: r.invoice_no, partyId: r.party_id, partyName: r.party_name, phone: r.party_phone || '', remaining: r2(num(r.amount) - num(r.paid)) }));
  },

  // ================================================================ Documents
  async addDocument(ownerType: Doc['ownerType'], ownerId: number, label: string, file: string): Promise<number> {
    return (await db.runAsync('INSERT INTO documents (owner_type, owner_id, label, file, created_at) VALUES (?, ?, ?, ?, ?)', [ownerType, ownerId, label.trim(), file, Date.now()])).lastInsertRowId;
  },
  async listDocuments(ownerType: Doc['ownerType'], ownerId: number): Promise<Doc[]> {
    return (await db.getAllAsync<any>('SELECT * FROM documents WHERE owner_type = ? AND owner_id = ? ORDER BY id', [ownerType, ownerId])).map(toDoc);
  },
  async deleteDocument(id: number): Promise<string | null> {
    const r = await db.getFirstAsync<{ file: string }>('SELECT file FROM documents WHERE id = ?', [id]);
    await db.runAsync('DELETE FROM documents WHERE id = ?', [id]);
    return r?.file ?? null;
  },
  async allDocumentFiles(): Promise<string[]> { return (await db.getAllAsync<{ file: string }>('SELECT file FROM documents')).map((r) => r.file); },

  // ================================================================ Expenses
  async addExpense(o: { branchId: number; accountId: number; date: string; category: string; amount: number; note?: string }) {
    if (!(o.amount > 0)) throw new Error('Enter a valid amount');
    await db.runAsync('INSERT INTO expenses (branch_id, account_id, date, category, amount, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [o.branchId, o.accountId, o.date, o.category, r2(o.amount), o.note || '', Date.now()]);
  },
  async listExpenses(o: { from: string; to: string; branchId?: number | null }): Promise<Expense[]> {
    return (await db.getAllAsync<any>(
      `SELECT e.*, a.name AS account_name FROM expenses e JOIN accounts a ON a.id = e.account_id WHERE e.date BETWEEN ? AND ? AND (? IS NULL OR e.branch_id = ?) ORDER BY e.date DESC, e.id DESC`,
      [o.from, o.to, o.branchId ?? null, o.branchId ?? null]))
      .map((r) => ({ id: r.id, branchId: r.branch_id, accountId: r.account_id, accountName: r.account_name, date: r.date, category: r.category, amount: num(r.amount), note: r.note || '' }));
  },
  async deleteExpense(id: number) { await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]); },

  // ================================================================ Dashboard & reports
  /** branchId null = all branches (owner view). */
  async dashboard(branchId: number | null = null): Promise<Dashboard> {
    const b = [branchId, branchId];
    const today = todayStr();
    const one = async (sql: string, params: any[]) => num((await db.getFirstAsync<{ v: number }>(sql, params))?.v);

    const accounts = await Repo.listAccounts(branchId);
    const balance = accounts.filter((a) => a.isActive).reduce((s, a) => s + a.balance, 0);
    const rep = await Repo.report(today, today, branchId);

    const nets = await db.getAllAsync<{ net: number }>(
      `SELECT SUM(amt) AS net FROM (
         SELECT party_id, total - exchange_value AS amt FROM sales WHERE party_id IS NOT NULL AND (? IS NULL OR branch_id = ?)
         UNION ALL SELECT party_id, -total FROM purchases WHERE party_id IS NOT NULL AND (? IS NULL OR branch_id = ?)
         UNION ALL SELECT party_id, CASE direction WHEN 'in' THEN -amount ELSE amount END FROM payments WHERE party_id IS NOT NULL AND (? IS NULL OR branch_id = ?)
       ) GROUP BY party_id`, [...b, ...b, ...b]);
    let receivable = 0, payable = 0;
    for (const n of nets) { const v = r2(num(n.net)); if (v > 0.004) receivable += v; else if (v < -0.004) payable += -v; }

    const stockValue =
      (await one("SELECT COALESCE(SUM(cost), 0) AS v FROM phones WHERE status IN ('in_stock','repair','transit') AND (? IS NULL OR branch_id = ?)", b)) +
      (await one('SELECT COALESCE(SUM(qty * cost), 0) AS v FROM accessories WHERE (? IS NULL OR branch_id = ?)', b));
    const phonesInStock = await one("SELECT COUNT(*) AS v FROM phones WHERE status = 'in_stock' AND (? IS NULL OR branch_id = ?)", b);
    const lowStock = await one('SELECT COUNT(*) AS v FROM accessories WHERE min_qty > 0 AND qty <= min_qty AND (? IS NULL OR branch_id = ?)', b);
    const od = await db.getFirstAsync<{ n: number; amt: number }>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(i.amount - i.paid), 0) AS amt
       FROM installments i JOIN installment_plans p ON p.id = i.plan_id JOIN sales s ON s.id = p.sale_id
       WHERE i.due_date < ? AND i.paid < i.amount AND (? IS NULL OR s.branch_id = ?)`, [today, ...b]);
    return {
      balance, todaySales: rep.salesTotal, todayProfit: rep.profit, receivable: r2(receivable), payable: r2(payable), stockValue, phonesInStock, lowStock,
      overdueCount: num(od?.n), overdueAmount: num(od?.amt),
    };
  },

  /** Profit = sale price - cost of what was sold - discount + installment markup. Trade-ins are stock, not income. */
  async report(from: string, to: string, branchId: number | null = null): Promise<Report> {
    const b = [branchId, branchId];
    const one = async (sql: string, params: any[]) => num((await db.getFirstAsync<{ v: number }>(sql, params))?.v);
    const salesTotal = await one('SELECT COALESCE(SUM(total), 0) AS v FROM sales WHERE date BETWEEN ? AND ? AND (? IS NULL OR branch_id = ?)', [from, to, ...b]);
    const salesCount = await one('SELECT COUNT(*) AS v FROM sales WHERE date BETWEEN ? AND ? AND (? IS NULL OR branch_id = ?)', [from, to, ...b]);
    const phonesSold = await one("SELECT COUNT(*) AS v FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE si.kind = 'phone' AND s.date BETWEEN ? AND ? AND (? IS NULL OR s.branch_id = ?)", [from, to, ...b]);
    const gross = await one('SELECT COALESCE(SUM(si.qty * (si.price - si.cost)), 0) AS v FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.date BETWEEN ? AND ? AND (? IS NULL OR s.branch_id = ?)', [from, to, ...b]);
    const adj = await one('SELECT COALESCE(SUM(markup - discount), 0) AS v FROM sales WHERE date BETWEEN ? AND ? AND (? IS NULL OR branch_id = ?)', [from, to, ...b]);
    const expenses = await one('SELECT COALESCE(SUM(amount), 0) AS v FROM expenses WHERE date BETWEEN ? AND ? AND (? IS NULL OR branch_id = ?)', [from, to, ...b]);
    const purchases = await one('SELECT COALESCE(SUM(total), 0) AS v FROM purchases WHERE date BETWEEN ? AND ? AND (? IS NULL OR branch_id = ?)', [from, to, ...b]);
    const collected = await one("SELECT COALESCE(SUM(amount), 0) AS v FROM payments WHERE direction = 'in' AND date BETWEEN ? AND ? AND (? IS NULL OR branch_id = ?)", [from, to, ...b]);
    const paidOut = await one("SELECT COALESCE(SUM(amount), 0) AS v FROM payments WHERE direction = 'out' AND date BETWEEN ? AND ? AND (? IS NULL OR branch_id = ?)", [from, to, ...b]);
    const profit = r2(gross + adj);
    return { from, to, salesTotal, salesCount, phonesSold, profit, expenses, net: r2(profit - expenses), purchases, collected, paidOut };
  },

  // ================================================================ Backup
  async exportAll(): Promise<{ app: string; version: number; exportedAt: string; tables: Record<string, any[]> }> {
    const names = (await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).map((t) => t.name);
    const tables: Record<string, any[]> = {};
    for (const n of names) tables[n] = await db.getAllAsync<any>(`SELECT * FROM "${n}"`);
    return { app: 'mobilix', version: 1, exportedAt: new Date().toISOString(), tables };
  },
  async importAll(payload: any): Promise<void> {
    if (!payload || payload.app !== 'mobilix' || typeof payload.tables !== 'object') throw new Error('This is not a Mobilix backup file');
    const known = (await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")).map((t) => t.name);
    const cols: Record<string, string[]> = {};
    for (const n of known) cols[n] = (await db.getAllAsync<{ name: string }>(`PRAGMA table_info("${n}")`)).map((c) => c.name);
    await db.execAsync('PRAGMA foreign_keys = OFF;');
    try {
      await db.withTransactionAsync(async () => {
        for (const n of known) await db.execAsync(`DELETE FROM "${n}";`);
        for (const [n, rows] of Object.entries<any[]>(payload.tables)) {
          if (!cols[n] || !Array.isArray(rows)) continue;
          for (const r of rows) {
            const keys = Object.keys(r).filter((k) => cols[n].includes(k));
            if (!keys.length) continue;
            await db.runAsync(`INSERT INTO "${n}" (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, keys.map((k) => r[k]));
          }
        }
      });
    } finally { await db.execAsync('PRAGMA foreign_keys = ON;'); }
    await ensureDefaults();
  },

  // ================================================================ Danger zone
  async wipeAll(): Promise<void> {
    const tables = await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
    await db.execAsync('PRAGMA foreign_keys = OFF;');
    try {
      for (const t of tables) await db.execAsync(`DELETE FROM "${t.name}";`);
      await db.execAsync('DELETE FROM sqlite_sequence;');
    } finally { await db.execAsync('PRAGMA foreign_keys = ON;'); }
    await ensureDefaults();
  },
};

function addDay(s: string, n: number): string {
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(y, m - 1, d + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/** Record money received on one bill and, if it has an installment plan, fill the oldest unpaid installments. Call inside a transaction. */
async function applySalePayment(saleId: number, partyId: number | null, amount: number, accountId: number, branchId: number, date: string, note?: string) {
  const plan = await db.getFirstAsync<any>('SELECT id FROM installment_plans WHERE sale_id = ?', [saleId]);
  let firstInst: number | null = null;
  if (plan) {
    const rows = (await db.getAllAsync<any>('SELECT * FROM installments WHERE plan_id = ? ORDER BY seq', [plan.id])).map(toInstallment);
    const { alloc } = allocate(rows, amount);
    for (const a of alloc) {
      firstInst = firstInst ?? a.id;
      const row = rows.find((r) => r.id === a.id)!;
      const paid = r2(row.paid + a.add);
      await db.runAsync('UPDATE installments SET paid = ?, paid_at = ? WHERE id = ?', [paid, paid >= row.amount ? date : '', a.id]);
    }
  }
  await insertPayment({ branchId, accountId, partyId, saleId, installmentId: firstInst, direction: 'in', amount, date, note });
}
