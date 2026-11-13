import assert from 'node:assert/strict';
import { createNodeDb } from './nodeDb';
import { initRepo, Repo, getDb } from '../src/db/repo';

const run = async () => {
  await initRepo(createNodeDb());
  const db = getDb();
  const NOW = Date.now();

  // fresh install: one branch + one Cash account
  const branches = await Repo.listBranches();
  assert.equal(branches.length, 1);
  const b1 = branches[0].id;
  let accounts = await Repo.listAccounts();
  assert.equal(accounts.length, 1);
  const cash = accounts[0].id;
  assert.equal(accounts[0].balance, 0);

  // empty dashboard is all zeros
  let d = await Repo.dashboard();
  assert.deepEqual(
    [d.balance, d.todaySales, d.todayProfit, d.receivable, d.payable, d.stockValue, d.phonesInStock, d.lowStock, d.overdueCount],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  );

  // a phone bought for 80,000 from a supplier, 30,000 paid now -> we owe 50,000; stock value 80,000; cash 70,000 after 100k opening
  await db.runAsync('UPDATE accounts SET opening = 100000 WHERE id = ?', [cash]);
  const sup = (await db.runAsync("INSERT INTO parties (kind, name, created_at) VALUES ('supplier', 'Ali Traders', ?)", [NOW])).lastInsertRowId;
  const pur = (await db.runAsync("INSERT INTO purchases (branch_id, party_id, date, total, created_at) VALUES (?, ?, '2026-11-12', 80000, ?)", [b1, sup, NOW])).lastInsertRowId;
  const ph = (await db.runAsync(
    "INSERT INTO phones (branch_id, brand, model, imei1, cost, price, qr, purchase_id, created_at, updated_at) VALUES (?, 'Apple', 'iPhone 13', '350000000000001', 80000, 95000, 'MBX-P-1', ?, ?, ?)",
    [b1, pur, NOW, NOW])).lastInsertRowId;
  await db.runAsync("INSERT INTO payments (branch_id, account_id, party_id, purchase_id, direction, amount, date, created_at) VALUES (?, ?, ?, ?, 'out', 30000, '2026-11-12', ?)", [b1, cash, sup, pur, NOW]);
  d = await Repo.dashboard();
  assert.equal(d.balance, 70000);
  assert.equal(d.payable, 50000);
  assert.equal(d.stockValue, 80000);
  assert.equal(d.phonesInStock, 1);

  // the same IMEI cannot be in stock twice
  await assert.rejects(() => db.runAsync(
    "INSERT INTO phones (branch_id, brand, model, imei1, qr, created_at, updated_at) VALUES (?, 'Apple', 'iPhone 13', '350000000000001', 'MBX-P-2', ?, ?)", [b1, NOW, NOW]));

  // sale today: 95,000 with 1,000 discount, customer pays 40,000 now -> they owe 54,000; profit 14,000
  const today = new Date(); const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const cus = (await db.runAsync("INSERT INTO parties (kind, name, created_at) VALUES ('customer', 'Bilal', ?)", [NOW])).lastInsertRowId;
  const sale = (await db.runAsync("INSERT INTO sales (branch_id, invoice_no, party_id, date, kind, discount, total, created_at) VALUES (?, 'INV-1', ?, ?, 'credit', 1000, 94000, ?)", [b1, cus, ymd, NOW])).lastInsertRowId;
  await db.runAsync("INSERT INTO sale_items (sale_id, kind, phone_id, qty, price, cost) VALUES (?, 'phone', ?, 1, 95000, 80000)", [sale, ph]);
  await db.runAsync("UPDATE phones SET status = 'sold' WHERE id = ?", [ph]);
  await db.runAsync("INSERT INTO payments (branch_id, account_id, party_id, sale_id, direction, amount, date, created_at) VALUES (?, ?, ?, ?, 'in', 40000, ?, ?)", [b1, cash, cus, sale, ymd, NOW]);
  d = await Repo.dashboard();
  assert.equal(d.todaySales, 94000);
  assert.equal(d.todayProfit, 14000);
  assert.equal(d.receivable, 54000);
  assert.equal(d.balance, 110000);
  assert.equal(d.phonesInStock, 0);
  assert.equal(d.stockValue, 0);

  // the sold IMEI can come back into stock (trade-in), but not twice
  await db.runAsync("INSERT INTO phones (branch_id, brand, model, imei1, qr, created_at, updated_at) VALUES (?, 'Apple', 'iPhone 13', '350000000000001', 'MBX-P-3', ?, ?)", [b1, NOW, NOW]);

  // installment overdue: one unpaid instalment due in the past
  const plan = (await db.runAsync("INSERT INTO installment_plans (sale_id, party_id, months, first_due, created_at) VALUES (?, ?, 2, '2020-01-01', ?)", [sale, cus, NOW])).lastInsertRowId;
  await db.runAsync("INSERT INTO installments (plan_id, seq, due_date, amount, paid) VALUES (?, 1, '2020-01-01', 27000, 7000)", [plan]);
  d = await Repo.dashboard();
  assert.equal(d.overdueCount, 1);
  assert.equal(d.overdueAmount, 20000);

  // expense + transfer move the account balances
  const bank = await Repo.addAccount(b1, 'Meezan Bank', 'bank', 5000);
  await db.runAsync("INSERT INTO expenses (branch_id, account_id, date, category, amount, created_at) VALUES (?, ?, ?, 'rent', 10000, ?)", [b1, cash, ymd, NOW]);
  await db.runAsync("INSERT INTO transfers (from_account_id, to_account_id, amount, date, created_at) VALUES (?, ?, 20000, ?, ?)", [cash, bank, ymd, NOW]);
  accounts = await Repo.listAccounts();
  assert.equal(accounts.find((a) => a.id === cash)!.balance, 110000 - 10000 - 20000);
  assert.equal(accounts.find((a) => a.id === bank)!.balance, 25000);
  assert.equal((await Repo.dashboard()).balance, 105000);

  // branches: a second branch gets its own Cash account and the dashboard can be filtered
  const b2 = await Repo.addBranch('Saddar');
  assert.equal((await Repo.listAccounts(b2)).length, 1);
  assert.equal((await Repo.dashboard(b2)).balance, 0);
  assert.equal((await Repo.dashboard(b1)).balance, 105000);

  // settings round-trip keeps the currency config
  const s = await Repo.getSettings();
  await Repo.saveSettings({ ...s, shopName: 'Test Mobiles' });
  assert.equal((await Repo.getSettings()).shopName, 'Test Mobiles');
  assert.equal((await Repo.getSettings()).currency.code, 'PKR');

  // wipe leaves a usable fresh app
  await Repo.wipeAll();
  assert.equal((await Repo.listBranches()).length, 1);
  assert.equal((await Repo.listAccounts()).length, 1);
  assert.equal((await Repo.dashboard()).balance, 0);

  console.log('db tests passed');
};
run().catch((e) => { console.error(e); process.exit(1); });
