// SQLite schema + migrations (tracked with PRAGMA user_version).
// Anything that talks to SQLite goes through the small `Db` interface so the same code runs on expo-sqlite (app) and node:sqlite (tests).
//
// Money convention: payments are the single source of truth for what was paid. sales.total / purchases.total are the amounts billed;
// "customer owes" = sum(sales.total) - sum(payments in for that sale). Never store a separate "paid" figure on a sale.

export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: any[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(sql: string, params?: any[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: any[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

const MIGRATIONS: string[] = [
  // v1 — initial schema
  `
  CREATE TABLE settings (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL);

  CREATE TABLE branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'cash' CHECK (type IN ('cash','bank','wallet')),
    opening REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_accounts_branch ON accounts(branch_id);

  CREATE TABLE parties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL DEFAULT 'customer' CHECK (kind IN ('customer','supplier','both')),
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    cnic TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_parties_name ON parties(name COLLATE NOCASE);
  CREATE INDEX idx_parties_phone ON parties(phone);

  -- one row per physical handset (IMEI-tracked)
  CREATE TABLE phones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    storage TEXT NOT NULL DEFAULT '',
    ram TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '',
    condition TEXT NOT NULL DEFAULT 'new' CHECK (condition IN ('new','used')),
    grade TEXT NOT NULL DEFAULT '',
    pta TEXT NOT NULL DEFAULT 'unknown' CHECK (pta IN ('approved','non_pta','unknown')),
    battery INTEGER,
    imei1 TEXT NOT NULL,
    imei2 TEXT NOT NULL DEFAULT '',
    cost REAL NOT NULL DEFAULT 0,
    price REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock','sold','returned','repair','transit')),
    qr TEXT NOT NULL UNIQUE,
    notes TEXT NOT NULL DEFAULT '',
    purchase_id INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  -- the same IMEI may come back (trade-in / return) once it has left stock, but never twice at the same time
  CREATE UNIQUE INDEX idx_phones_imei_live ON phones(imei1) WHERE status IN ('in_stock','repair','transit');
  CREATE INDEX idx_phones_branch_status ON phones(branch_id, status);
  CREATE INDEX idx_phones_imei1 ON phones(imei1);
  CREATE INDEX idx_phones_imei2 ON phones(imei2);

  CREATE TABLE accessories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    sku TEXT NOT NULL DEFAULT '',
    qr TEXT NOT NULL UNIQUE,
    qty REAL NOT NULL DEFAULT 0,
    min_qty REAL NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0,
    price REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_accessories_branch ON accessories(branch_id);

  CREATE TABLE purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    party_id INTEGER REFERENCES parties(id),
    date TEXT NOT NULL,
    total REAL NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_purchases_party ON purchases(party_id);
  CREATE INDEX idx_purchases_date ON purchases(date);

  CREATE TABLE purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('phone','accessory')),
    phone_id INTEGER REFERENCES phones(id),
    accessory_id INTEGER REFERENCES accessories(id),
    qty REAL NOT NULL DEFAULT 1,
    cost REAL NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);

  CREATE TABLE sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    invoice_no TEXT NOT NULL UNIQUE,
    party_id INTEGER REFERENCES parties(id),
    date TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'cash' CHECK (kind IN ('cash','credit','installment')),
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    exchange_phone_id INTEGER REFERENCES phones(id),
    exchange_value REAL NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_sales_party ON sales(party_id);
  CREATE INDEX idx_sales_date ON sales(date);
  CREATE INDEX idx_sales_branch ON sales(branch_id);

  CREATE TABLE sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('phone','accessory')),
    phone_id INTEGER REFERENCES phones(id),
    accessory_id INTEGER REFERENCES accessories(id),
    qty REAL NOT NULL DEFAULT 1,
    price REAL NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);

  CREATE TABLE installment_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL UNIQUE REFERENCES sales(id) ON DELETE CASCADE,
    party_id INTEGER NOT NULL REFERENCES parties(id),
    advance REAL NOT NULL DEFAULT 0,
    months INTEGER NOT NULL,
    markup REAL NOT NULL DEFAULT 0,
    first_due TEXT NOT NULL,
    guarantor_name TEXT NOT NULL DEFAULT '',
    guarantor_phone TEXT NOT NULL DEFAULT '',
    guarantor_cnic TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE installments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL REFERENCES installment_plans(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    due_date TEXT NOT NULL,
    amount REAL NOT NULL,
    paid REAL NOT NULL DEFAULT 0,
    paid_at TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX idx_installments_plan ON installments(plan_id);
  CREATE INDEX idx_installments_due ON installments(due_date);

  CREATE TABLE payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    party_id INTEGER REFERENCES parties(id),
    sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
    purchase_id INTEGER REFERENCES purchases(id) ON DELETE CASCADE,
    installment_id INTEGER REFERENCES installments(id) ON DELETE SET NULL,
    direction TEXT NOT NULL CHECK (direction IN ('in','out')),
    amount REAL NOT NULL CHECK (amount > 0),
    date TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'cash',
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_payments_party ON payments(party_id);
  CREATE INDEX idx_payments_sale ON payments(sale_id);
  CREATE INDEX idx_payments_purchase ON payments(purchase_id);
  CREATE INDEX idx_payments_account ON payments(account_id);
  CREATE INDEX idx_payments_date ON payments(date);

  CREATE TABLE expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    date TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    amount REAL NOT NULL CHECK (amount > 0),
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_expenses_date ON expenses(date);

  CREATE TABLE transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_account_id INTEGER NOT NULL REFERENCES accounts(id),
    to_account_id INTEGER NOT NULL REFERENCES accounts(id),
    amount REAL NOT NULL CHECK (amount > 0),
    date TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );

  -- files (CNIC photo, agreement, ...) attached to a sale / purchase / party / phone; the file itself lives in app storage
  CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_type TEXT NOT NULL CHECK (owner_type IN ('sale','purchase','party','phone')),
    owner_id INTEGER NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    file TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_documents_owner ON documents(owner_type, owner_id);
  `,
  // v2 — installment markup is revenue on the sale
  `
  ALTER TABLE sales ADD COLUMN markup REAL NOT NULL DEFAULT 0;
  `,
];

export async function migrate(db: Db): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let v = row?.user_version ?? 0;
  while (v < MIGRATIONS.length) {
    const sql = MIGRATIONS[v];
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${v + 1};`);
    });
    v++;
  }
}
