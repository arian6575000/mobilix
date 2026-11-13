import assert from 'node:assert/strict';
import { createNodeDb } from './nodeDb';
import { initRepo, Repo } from '../src/db/repo';
import { buildSchedule, allocate } from '../src/lib/installments';
import { addMonths } from '../src/lib/dates';
import type { PhoneDraft } from '../src/db/types';

const rejects = async (fn: () => Promise<any>, msg: RegExp) => { await assert.rejects(fn, msg); };
const draft = (imei: string, cost = 80000, price = 95000, extra: Partial<PhoneDraft> = {}): PhoneDraft =>
  ({ brand: 'Apple', model: 'iPhone 13', storage: '128GB', condition: 'new', imei1: imei, cost, price, ...extra });
const TODAY = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();

(async () => {
  // ---- pure helpers
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('2026-11-15', 3), '2027-02-15');
  const sch = buildSchedule(10000, 3, '2026-12-01');
  assert.deepEqual(sch.map((r) => r.amount), [3333.33, 3333.33, 3333.34]);
  assert.equal(sch.reduce((s, r) => Math.round((s + r.amount) * 100) / 100, 0), 10000);
  assert.deepEqual(sch.map((r) => r.dueDate), ['2026-12-01', '2027-01-01', '2027-02-01']);
  assert.throws(() => buildSchedule(0, 3, '2026-12-01'));
  assert.throws(() => buildSchedule(100, 0, '2026-12-01'));
  const al = allocate([{ id: 1, amount: 100, paid: 100 }, { id: 2, amount: 100, paid: 40 }, { id: 3, amount: 100, paid: 0 }], 130);
  assert.deepEqual(al, { alloc: [{ id: 2, add: 60 }, { id: 3, add: 70 }], rest: 0 });

  await initRepo(createNodeDb());
  const b1 = await Repo.defaultBranchId();
  const cash = (await Repo.listAccounts())[0].id;
  const bank = await Repo.addAccount(b1, 'Meezan', 'bank', 0);
  await Repo.addAccount(b1, 'x', 'cash', 0);

  // ---- parties
  const sup = await Repo.saveParty({ kind: 'supplier', name: 'Ali Traders', phone: '0300-1111111' });
  const cus = await Repo.saveParty({ kind: 'customer', name: 'Bilal', phone: '0301-2222222', cnic: '42101-1234567-1' });
  await rejects(() => Repo.saveParty({ kind: 'customer', name: '  ' }), /Name is required/);
  assert.equal((await Repo.listParties({ kind: 'customer' })).length, 1);
  assert.equal((await Repo.listParties({ q: 'ali' })).length, 1);

  // ---- purchase validation
  await rejects(() => Repo.createPurchase({ branchId: b1, partyId: sup, date: TODAY, phones: [draft('123')], accessories: [], paid: 0, accountId: null }), /15 digits/);
  await rejects(() => Repo.createPurchase({ branchId: b1, partyId: sup, date: TODAY, phones: [draft('350000000000001'), draft('350000000000001')], accessories: [], paid: 0, accountId: null }), /entered twice/);
  await rejects(() => Repo.createPurchase({ branchId: b1, partyId: sup, date: TODAY, phones: [draft('350000000000001')], accessories: [], paid: 90000, accountId: cash }), /more than the total/);
  await rejects(() => Repo.createPurchase({ branchId: b1, partyId: null, date: TODAY, phones: [draft('350000000000001')], accessories: [], paid: 0, accountId: null }), /supplier/);
  assert.equal((await Repo.listPhones()).length, 0, 'failed purchases leave nothing behind');

  // ---- purchase: 2 phones + accessory, 100,000 paid from bank, rest on credit
  await Repo.addAccount(b1, 'noop', 'wallet', 0);
  await db0(bank, 500000);
  const glass = await Repo.addAccessory(b1, { name: 'Tempered Glass', category: 'Glass', qty: 0, minQty: 5, cost: 100, price: 300 });
  const pur = await Repo.createPurchase({
    branchId: b1, partyId: sup, date: TODAY, accountId: bank, paid: 100000,
    phones: [draft('350000000000001'), draft('350000000000002', 60000, 72000, { condition: 'used', grade: 'A' })],
    accessories: [{ accessoryId: glass, qty: 10, cost: 120 }],
  });
  assert.ok(pur > 0);
  let phones = await Repo.listPhones({ status: 'in_stock' });
  assert.equal(phones.length, 2);
  assert.match(phones[0].qr, /^MBX:P:\d+$/);
  assert.equal((await Repo.getAccessory(glass))!.qty, 10);
  assert.equal((await Repo.getAccessory(glass))!.cost, 120);
  assert.equal((await Repo.getParty(sup))!.balance, -(80000 + 60000 + 1200 - 100000)); // we owe 41,200
  await rejects(() => Repo.createPurchase({ branchId: b1, partyId: sup, date: TODAY, phones: [draft('350000000000001')], accessories: [], paid: 0, accountId: null }), /already in stock/);

  // ---- scan resolution
  const p1 = phones.find((p) => p.imei1 === '350000000000001')!;
  const p2 = phones.find((p) => p.imei1 === '350000000000002')!;
  assert.equal((await Repo.resolveScan(p1.qr) as any).phone.id, p1.id);
  assert.equal((await Repo.resolveScan('350000000000002') as any).phone.id, p2.id);
  assert.equal((await Repo.resolveScan(`MBX:A:${glass}`) as any).accessory.id, glass);
  assert.equal(await Repo.resolveScan('nothing'), null);

  // ---- cash sale: phone 1 + 2 glass, 500 discount
  const s1 = await Repo.createSale({
    branchId: b1, partyId: null, date: TODAY, kind: 'cash', accountId: cash, paid: 0, discount: 500, invoicePrefix: 'MX-',
    items: [{ kind: 'phone', phoneId: p1.id, price: 95000 }, { kind: 'accessory', accessoryId: glass, qty: 2, price: 300 }],
  });
  let d1 = (await Repo.getSale(s1))!;
  assert.equal(d1.sale.invoiceNo, 'MX-00001');
  assert.equal(d1.sale.total, 95100);
  assert.equal(d1.sale.paid, 95100);
  assert.equal(d1.sale.due, 0);
  assert.equal((await Repo.getPhone(p1.id))!.status, 'sold');
  assert.equal((await Repo.getAccessory(glass))!.qty, 8);
  assert.equal((await Repo.saleOfPhone(p1.id))!.saleId, s1);
  await rejects(() => Repo.createSale({ branchId: b1, partyId: null, date: TODAY, kind: 'cash', accountId: cash, paid: 0, discount: 0, items: [{ kind: 'phone', phoneId: p1.id, price: 1 }] }), /not in stock/);
  await rejects(() => Repo.createSale({ branchId: b1, partyId: null, date: TODAY, kind: 'cash', accountId: cash, paid: 0, discount: 0, items: [{ kind: 'accessory', accessoryId: glass, qty: 99, price: 1 }] }), /Only 8/);
  await rejects(() => Repo.createSale({ branchId: b1, partyId: null, date: TODAY, kind: 'credit', accountId: cash, paid: 0, discount: 0, items: [{ kind: 'phone', phoneId: p2.id, price: 72000 }] }), /Choose the customer/);
  assert.equal((await Repo.getPhone(p2.id))!.status, 'in_stock', 'failed sale changes nothing');

  // ---- installment sale with a trade-in: bill 72,000 + 6,000 markup, trade-in worth 20,000, advance 10,000
  //      net 58,000 - 10,000 = 48,000 over 4 months = 12,000 each
  const s2 = await Repo.createSale({
    branchId: b1, partyId: cus, date: TODAY, kind: 'installment', accountId: cash, paid: 10000, discount: 0,
    items: [{ kind: 'phone', phoneId: p2.id, price: 72000 }],
    exchange: { ...draft('350000000000003', 0, 24000, { brand: 'Samsung', model: 'A12', condition: 'used' }), value: 20000 },
    plan: { months: 4, markup: 6000, firstDue: '2020-01-10', guarantorName: 'Kamran', guarantorPhone: '0302', guarantorCnic: '42101-7654321-9' },
  });
  let d2 = (await Repo.getSale(s2))!;
  assert.equal(d2.sale.total, 78000);
  assert.equal(d2.sale.exchangeValue, 20000);
  assert.equal(d2.sale.paid, 10000);
  assert.equal(d2.sale.due, 48000);
  assert.deepEqual(d2.installments.map((i) => i.amount), [12000, 12000, 12000, 12000]);
  assert.equal(d2.exchangePhone!.status, 'in_stock');
  assert.equal(d2.exchangePhone!.cost, 20000);
  assert.equal(d2.plan!.guarantorName, 'Kamran');
  assert.equal((await Repo.getParty(cus))!.balance, 48000);

  // the traded-in phone is now sellable stock
  assert.equal((await Repo.listPhones({ status: 'in_stock' })).some((p) => p.imei1 === '350000000000003'), true);

  // overdue list (first due 2020) and dashboard
  const overdue = await Repo.dueInstallments({});
  assert.equal(overdue.length, 4);
  assert.equal(overdue[0].partyName, 'Bilal');
  let dash = await Repo.dashboard();
  assert.equal(dash.overdueCount, 4);
  assert.equal(dash.overdueAmount, 48000);
  assert.equal(dash.receivable, 48000);
  assert.equal(dash.payable, 41200);

  // pay 30,000: fills installment 1, 2 and half of 3 (oldest first)
  await Repo.receiveSalePayment({ saleId: s2, amount: 30000, accountId: cash, date: TODAY });
  d2 = (await Repo.getSale(s2))!;
  assert.deepEqual(d2.installments.map((i) => i.paid), [12000, 12000, 6000, 0]);
  assert.equal(d2.sale.due, 18000);
  await rejects(() => Repo.receiveSalePayment({ saleId: s2, amount: 99999, accountId: cash, date: TODAY }), /Only 18000 is due/);
  await Repo.receiveSalePayment({ saleId: s2, amount: 18000, accountId: bank, date: TODAY });
  d2 = (await Repo.getSale(s2))!;
  assert.equal(d2.sale.due, 0);
  assert.ok(d2.installments.every((i) => i.paid === i.amount));
  assert.equal((await Repo.getParty(cus))!.balance, 0);
  assert.equal((await Repo.dueInstallments({})).length, 0);

  // ---- credit sale (bill 900, 400 now), then a khata payment that must clear the bill it belongs to
  await rejects(() => Repo.createSale({ branchId: b1, partyId: cus, date: TODAY, kind: 'credit', accountId: cash, paid: 1000, discount: 0, items: [{ kind: 'accessory', accessoryId: glass, qty: 3, price: 300 }] }), /more than the bill/);
  const s3 = await Repo.createSale({
    branchId: b1, partyId: cus, date: TODAY, kind: 'credit', accountId: cash, paid: 400, discount: 0,
    items: [{ kind: 'accessory', accessoryId: glass, qty: 3, price: 300 }],
  });
  assert.equal((await Repo.getSale(s3))!.sale.due, 500);
  assert.equal((await Repo.getParty(cus))!.balance, 500);
  await Repo.partyPayment({ partyId: cus, direction: 'in', amount: 700, accountId: cash, date: TODAY });
  assert.equal((await Repo.getSale(s3))!.sale.due, 0, 'khata payment clears the oldest bill');
  assert.equal((await Repo.getParty(cus))!.balance, -200, 'the extra 200 stays as an advance');

  // ---- supplier payment clears the purchase it belongs to
  await Repo.partyPayment({ partyId: sup, direction: 'out', amount: 41200, accountId: bank, date: TODAY });
  assert.equal((await Repo.getParty(sup))!.balance, 0);
  assert.equal((await Repo.listPurchases())[0].due, 0);

  // ---- ledger: running balance ends at the party balance
  const led = await Repo.partyLedger(cus);
  assert.equal(led[led.length - 1].balance, (await Repo.getParty(cus))!.balance);
  assert.ok(led.some((e) => e.type === 'sale') && led.some((e) => e.type === 'payment_in'));

  // ---- money moved through the right accounts
  const acc = await Repo.listAccounts();
  const cashBal = acc.find((a) => a.id === cash)!.balance;
  const bankBal = acc.find((a) => a.id === bank)!.balance;
  // cash in: 95,100 (cash sale) + 10,000 advance + 30,000 + 400 + 700 ; bank: 500,000 opening - 100,000 - 41,200 + 18,000
  assert.equal(cashBal, 95100 + 10000 + 30000 + 400 + 700);
  assert.equal(bankBal, 500000 - 100000 - 41200 + 18000);

  // ---- expenses, report
  await Repo.addExpense({ branchId: b1, accountId: cash, date: TODAY, category: 'rent', amount: 5000 });
  await Repo.addExpense({ branchId: b1, accountId: cash, date: TODAY, category: 'tea', amount: 250, note: 'x' });
  await rejects(() => Repo.addExpense({ branchId: b1, accountId: cash, date: TODAY, category: 'rent', amount: 0 }), /valid amount/);
  const rep = await Repo.report(TODAY, TODAY);
  // phone1: 95,000-80,000=15,000 ; glass 2x(300-120)=360 ; phone2: 72,000-60,000=12,000 ; glass 3x180=540
  // gross 27,900 ; discount -500 ; markup +6,000 => 33,400
  assert.equal(rep.profit, 15000 + 360 + 12000 + 540 - 500 + 6000);
  assert.equal(rep.expenses, 5250);
  assert.equal(rep.net, rep.profit - 5250);
  assert.equal(rep.salesCount, 3);
  assert.equal(rep.phonesSold, 2);
  assert.equal(rep.salesTotal, 95100 + 78000 + 900);
  assert.equal((await Repo.listExpenses({ from: TODAY, to: TODAY })).length, 2);

  // ---- documents (CNIC photo on a sale)
  const doc = await Repo.addDocument('sale', s2, 'CNIC front', 'doc_a.jpg');
  await Repo.addDocument('sale', s2, 'CNIC back', 'doc_b.jpg');
  assert.equal((await Repo.listDocuments('sale', s2)).length, 2);
  assert.equal(await Repo.deleteDocument(doc), 'doc_a.jpg');
  assert.deepEqual(await Repo.allDocumentFiles(), ['doc_b.jpg']);

  // ---- party delete guard
  await rejects(() => Repo.deleteParty(cus), /cannot be deleted/);
  const tmp = await Repo.saveParty({ kind: 'customer', name: 'Temp' });
  await Repo.deleteParty(tmp);

  // ---- transfer phone between branches
  const b2 = await Repo.addBranch('Saddar');
  const spare = (await Repo.listPhones({ status: 'in_stock' }))[0];
  await Repo.transferPhone(spare.id, b2);
  assert.equal((await Repo.getPhone(spare.id))!.branchId, b2);
  assert.equal((await Repo.dashboard(b2)).phonesInStock, 1);

  // ---- backup round-trip: export, wipe, import -> same numbers
  const before = await Repo.dashboard();
  const snap = JSON.parse(JSON.stringify(await Repo.exportAll()));
  await Repo.wipeAll();
  assert.equal((await Repo.listSales()).length, 0);
  await Repo.importAll(snap);
  const after = await Repo.dashboard();
  assert.deepEqual(after, before);
  assert.equal((await Repo.getSale(s2))!.installments.length, 4);
  await rejects(() => Repo.importAll({ app: 'other' }), /not a Mobilix backup/);

  console.log('repo tests passed');
}) ().catch((e) => { console.error(e); process.exit(1); });

async function db0(accountId: number, amount: number) {
  const { getDb } = await import('../src/db/repo');
  await getDb().runAsync('UPDATE accounts SET opening = ? WHERE id = ?', [amount, accountId]);
}
