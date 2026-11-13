export type Lang = 'en' | 'ur';

export interface CurrencyCfg {
  code: string; // PKR
  symbol: string; // Rs
  decimals: 0 | 1 | 2;
  symbolAfter: boolean; // 1,200 AED  vs  Rs 1,200
}

export const CURRENCIES: CurrencyCfg[] = [
  { code: 'PKR', symbol: 'Rs', decimals: 0, symbolAfter: false },
  { code: 'AED', symbol: 'AED', decimals: 2, symbolAfter: true },
  { code: 'SAR', symbol: 'SAR', decimals: 2, symbolAfter: true },
  { code: 'USD', symbol: '$', decimals: 2, symbolAfter: false },
  { code: 'INR', symbol: '₹', decimals: 0, symbolAfter: false },
  { code: 'BDT', symbol: '৳', decimals: 0, symbolAfter: false },
  { code: 'AFN', symbol: '؋', decimals: 0, symbolAfter: false },
];

export interface Settings {
  language: Lang;
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  currency: CurrencyCfg;
  countryCode: string; // WhatsApp default, '92'
  invoicePrefix: string;
  receiptFooter: string;
  paperWidth: 58 | 80;
  activeBranchId: number | null; // null = all branches (owner view)
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  shopName: '',
  ownerName: '',
  phone: '',
  address: '',
  currency: CURRENCIES[0],
  countryCode: '92',
  invoicePrefix: 'INV-',
  receiptFooter: 'Thank you for your business',
  paperWidth: 80,
  activeBranchId: null,
};

export type AccountType = 'cash' | 'bank' | 'wallet';
export interface Branch { id: number; name: string; address: string; phone: string; isDefault: boolean }
export interface Account { id: number; branchId: number; name: string; type: AccountType; opening: number; balance: number; isActive: boolean }

export interface Dashboard {
  balance: number; // cash + bank + wallet
  todaySales: number;
  todayProfit: number;
  receivable: number; // customers owe us
  payable: number; // we owe suppliers
  stockValue: number;
  phonesInStock: number;
  lowStock: number;
  overdueCount: number;
  overdueAmount: number;
}

// ---------------------------------------------------------------- parties
export type PartyKind = 'customer' | 'supplier' | 'both';
export interface Party { id: number; kind: PartyKind; name: string; phone: string; cnic: string; address: string; notes: string; balance: number }
export interface PartyInput { kind: PartyKind; name: string; phone?: string; cnic?: string; address?: string; notes?: string }

// ---------------------------------------------------------------- stock
export type PhoneStatus = 'in_stock' | 'sold' | 'returned' | 'repair' | 'transit';
export type PhoneCondition = 'new' | 'used';
export type Pta = 'approved' | 'non_pta' | 'unknown';
export interface Phone {
  id: number; branchId: number; brand: string; model: string; storage: string; ram: string; color: string;
  condition: PhoneCondition; grade: string; pta: Pta; battery: number | null; imei1: string; imei2: string;
  cost: number; price: number; status: PhoneStatus; qr: string; notes: string; createdAt: number;
}
export interface PhoneDraft {
  brand: string; model: string; storage?: string; ram?: string; color?: string; condition: PhoneCondition; grade?: string;
  pta?: Pta; battery?: number | null; imei1: string; imei2?: string; cost: number; price: number; notes?: string;
}
export interface Accessory { id: number; branchId: number; name: string; category: string; sku: string; qr: string; qty: number; minQty: number; cost: number; price: number }
export interface AccessoryInput { name: string; category?: string; sku?: string; qty?: number; minQty?: number; cost: number; price: number }

// ---------------------------------------------------------------- purchase
export interface PurchaseInput {
  branchId: number; partyId: number | null; date: string; phones: PhoneDraft[];
  accessories: { accessoryId: number; qty: number; cost: number }[];
  paid: number; accountId: number | null; note?: string;
}

// ---------------------------------------------------------------- sale
export type SaleKind = 'cash' | 'credit' | 'installment';
export type SaleLine = { kind: 'phone'; phoneId: number; price: number } | { kind: 'accessory'; accessoryId: number; qty: number; price: number };
export interface PlanInput { months: number; markup: number; firstDue: string; guarantorName?: string; guarantorPhone?: string; guarantorCnic?: string }
export interface SaleInput {
  branchId: number; partyId: number | null; date: string; kind: SaleKind; items: SaleLine[]; discount: number;
  exchange?: (PhoneDraft & { value: number }) | null;
  paid: number; accountId: number | null; plan?: PlanInput | null; note?: string; invoicePrefix?: string;
}
export interface SaleRow {
  id: number; invoiceNo: string; date: string; kind: SaleKind; partyId: number | null; partyName: string;
  total: number; exchangeValue: number; paid: number; due: number; summary: string; branchId: number;
}
export interface InstallmentRow { id: number; planId: number; seq: number; dueDate: string; amount: number; paid: number; paidAt: string }
export interface DueRow extends InstallmentRow { saleId: number; invoiceNo: string; partyId: number; partyName: string; phone: string; remaining: number }
export interface SaleDetail {
  sale: SaleRow & { discount: number; markup: number; note: string };
  party: Party | null;
  items: { id: number; kind: 'phone' | 'accessory'; label: string; sub: string; qty: number; price: number; cost: number; phoneId: number | null }[];
  payments: { id: number; amount: number; date: string; accountName: string; note: string; direction: 'in' | 'out' }[];
  plan: { id: number; advance: number; months: number; markup: number; firstDue: string; guarantorName: string; guarantorPhone: string; guarantorCnic: string } | null;
  installments: InstallmentRow[];
  exchangePhone: Phone | null;
}

// ---------------------------------------------------------------- money
export interface Expense { id: number; branchId: number; accountId: number; accountName: string; date: string; category: string; amount: number; note: string }
export const EXPENSE_CATEGORIES = ['rent', 'electricity', 'salary', 'food', 'transport', 'repair', 'marketing', 'other'] as const;
export interface LedgerEntry { date: string; type: 'sale' | 'purchase' | 'payment_in' | 'payment_out'; label: string; debit: number; credit: number; balance: number; refId: number }
export interface Doc { id: number; ownerType: 'sale' | 'purchase' | 'party' | 'phone'; ownerId: number; label: string; file: string; createdAt: number }
export interface Report {
  from: string; to: string; salesTotal: number; salesCount: number; phonesSold: number; profit: number; expenses: number; net: number;
  purchases: number; collected: number; paidOut: number;
}
