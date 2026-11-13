// UI text: [English, Urdu]. English is proper English (never Roman Urdu); Urdu is shown only when the user switches the language.
import { D2 } from './dict2';
const D1: Record<string, [string, string]> = {
  // ---- navigation
  navHome: ['Home', 'ہوم'], navStock: ['Stock', 'اسٹاک'], navScan: ['Scan', 'اسکین'], navSales: ['Sales', 'سیل'], navMore: ['More', 'مزید'],
  // ---- common
  loading: ['Loading…', 'لوڈ ہو رہا ہے…'], save: ['Save', 'محفوظ کریں'], saved: ['Saved', 'محفوظ ہو گیا'], cancel: ['Cancel', 'منسوخ'],
  confirm: ['Confirm', 'تصدیق'], areYouSure: ['Are you sure?', 'کیا آپ کو یقین ہے؟'], done: ['Done', 'مکمل'], select: ['Select…', 'چنیں…'],
  pickDate: ['Pick a date', 'تاریخ چنیں'], search: ['Search', 'تلاش'], noMatches: ['No matches', 'کچھ نہیں ملا'], copied: ['Copied', 'کاپی ہو گیا'],
  comingSoon: ['Coming soon', 'جلد آ رہا ہے'], close: ['Close', 'بند کریں'], name: ['Name', 'نام'], phone: ['Phone', 'فون'], address: ['Address', 'پتہ'],
  // ---- home
  goodMorning: ['Good morning', 'صبح بخیر'], goodAfternoon: ['Good afternoon', 'سلام'], goodEvening: ['Good evening', 'شام بخیر'],
  totalBalance: ['Total balance', 'کل بیلنس'], totalBalanceHint: ['Cash, bank and wallets together', 'نقد، بینک اور والٹ ملا کر'],
  todaySales: ['Sales today', 'آج کی سیل'], todayProfit: ['Profit today', 'آج کا منافع'], customersOwe: ['Customers owe you', 'گاہکوں سے وصولی'],
  youOwe: ['You owe suppliers', 'سپلائرز کو ادائیگی'], stockValue: ['Stock value', 'اسٹاک کی مالیت'], phonesInStock: ['Phones in stock', 'اسٹاک میں فون'],
  lowStock: ['Low stock', 'کم اسٹاک'], overdue: ['Overdue installments', 'لیٹ اقساط'], quickActions: ['Quick actions', 'فوری کام'],
  sellPhone: ['New sale', 'نئی سیل'], buyPhone: ['Buy phone', 'فون خریدیں'], receivePayment: ['Receive payment', 'رقم وصول کریں'], addExpense: ['Add expense', 'خرچہ لکھیں'],
  allBranches: ['All branches', 'تمام برانچیں'], accounts: ['Accounts', 'اکاؤنٹس'],
  // ---- tab placeholders (built in the next phases)
  stockTitle: ['Stock', 'اسٹاک'], stockSoon: ['Phones (by IMEI) and accessories will be managed here.', 'یہاں فون (IMEI کے ساتھ) اور ایکسیسریز کا انتظام ہو گا۔'],
  salesTitle: ['Sales', 'سیل'], salesSoon: ['New sales, installments, exchange and receipts will be here.', 'یہاں نئی سیل، اقساط، ایکسچینج اور رسیدیں ہوں گی۔'],
  scanTitle: ['Scan', 'اسکین'], scanSoon: ['Scan a product QR code or IMEI to sell, find or count it.', 'سیل، تلاش یا گنتی کے لیے پروڈکٹ کا QR کوڈ یا IMEI اسکین کریں۔'],
  // ---- more / settings
  moreTitle: ['More', 'مزید'], shop: ['Shop', 'دکان'], shopName: ['Shop name', 'دکان کا نام'], ownerName: ['Owner name', 'مالک کا نام'],
  preferences: ['Preferences', 'ترجیحات'], language: ['Language', 'زبان'], english: ['English', 'English'], urdu: ['اردو', 'اردو'],
  currency: ['Currency', 'کرنسی'], currencyHint: ['Used for every price, receipt and report.', 'ہر قیمت، رسید اور رپورٹ میں یہی کرنسی استعمال ہو گی۔'],
  invoicePrefix: ['Invoice prefix', 'انوائس پریفکس'], receiptFooter: ['Receipt footer', 'رسید کا فوٹر'], paperWidth: ['Thermal paper width', 'تھرمل پیپر کی چوڑائی'],
  branch: ['Branch', 'برانچ'], activeBranch: ['Active branch', 'موجودہ برانچ'], addBranch: ['Add branch', 'برانچ شامل کریں'], branchName: ['Branch name', 'برانچ کا نام'],
  branchNeedsLicense: ['Multiple branches are not included in your license.', 'ایک سے زیادہ برانچیں آپ کے لائسنس میں شامل نہیں۔'],
  security: ['Security', 'سیکیورٹی'], pinLock: ['PIN lock', 'پن لاک'], pinOn: ['On', 'آن'], pinOff: ['Off', 'بند'], setPin: ['Set PIN', 'پن لگائیں'],
  changePin: ['Change PIN', 'پن تبدیل کریں'], removePin: ['Remove PIN', 'پن ہٹائیں'], biometric: ['Unlock with fingerprint', 'فنگر پرنٹ سے کھولیں'],
  license: ['License', 'لائسنس'], plan: ['Plan', 'پلان'], licensedTo: ['Licensed to', 'لائسنس یافتہ'], expires: ['Expires', 'مدت ختم'], lifetime: ['Lifetime', 'لائف ٹائم'],
  daysLeft: ['{n} days left', '{n} دن باقی'], deviceId: ['Device ID', 'ڈیوائس آئی ڈی'], about: ['About', 'ایپ کے بارے میں'], version: ['Version', 'ورژن'],
  dangerZone: ['Danger zone', 'خطرناک حصہ'], eraseAll: ['Erase all data', 'سارا ڈیٹا مٹا دیں'], eraseMsg: ['This permanently deletes everything in the app on this phone.', 'اس فون کی ایپ کا سارا ڈیٹا ہمیشہ کے لیے حذف ہو جائے گا۔'],
  eraseEverything: ['Erase everything', 'سب مٹا دیں'], erased: ['All data erased', 'سارا ڈیٹا مٹا دیا گیا'],
  // ---- PIN lock
  enterPin: ['Enter PIN', 'پن درج کریں'], wrongPin: ['Wrong PIN', 'غلط پن'], forgotPin: ['Forgot PIN?', 'پن بھول گئے؟'],
  forgotPinMsg: ['The only way to reset is to erase all data on this phone. Restore a backup afterwards.', 'ری سیٹ کا واحد طریقہ اس فون کا سارا ڈیٹا مٹانا ہے۔ بعد میں بیک اپ بحال کر لیں۔'],
  useBiometric: ['Use fingerprint', 'فنگر پرنٹ استعمال کریں'], pinWait: ['Too many attempts. Try again in {n}s', 'بہت زیادہ کوششیں۔ {n} سیکنڈ بعد دوبارہ کوشش کریں'],
  newPin: ['New 4-digit PIN', 'نیا 4 ہندسوں کا پن'], confirmPin: ['Confirm PIN', 'پن دوبارہ لکھیں'], enterCurrentPin: ['Current PIN', 'موجودہ پن'],
  pin4: ['PIN must be 4 digits', 'پن 4 ہندسوں کا ہونا چاہیے'], pinMismatch: ['PINs do not match', 'پن آپس میں نہیں ملتے'],
  pinSet: ['PIN saved', 'پن محفوظ ہو گیا'], pinRemoved: ['PIN removed', 'پن ہٹا دیا گیا'],
  // ---- license gate
  featureLocked: ['Not included in your license', 'یہ فیچر آپ کے لائسنس میں شامل نہیں'],
  licTitle: ['Activation required', 'ایکٹیویشن ضروری ہے'], licDeviceId: ['Your Device ID', 'آپ کا ڈیوائس آئی ڈی'],
  licHint: ['Send this Device ID to the software provider to get your license key.', 'لائسنس کے لیے یہ ڈیوائس آئی ڈی سافٹ ویئر فراہم کنندہ کو بھیجیں۔'],
  licCopy: ['Copy', 'کاپی'], licShare: ['Share', 'شیئر'], licPaste: ['License key', 'لائسنس کی'], licPasteBtn: ['Paste', 'پیسٹ'], licActivate: ['Activate', 'ایکٹیویٹ کریں'],
  licActivated: ['License activated', 'لائسنس ایکٹیویٹ ہو گیا'],
  licExpiring: ['License expires in {n} day(s). Contact your provider to renew.', 'لائسنس {n} دن میں ختم ہو رہا ہے۔ تجدید کے لیے رابطہ کریں۔'],
  licFormat: ['License format is wrong', 'لائسنس کا فارمیٹ غلط ہے'], licSignature: ['Invalid license (signature)', 'لائسنس درست نہیں (دستخط)'],
  licProject: ['This license is not for Mobilix', 'یہ لائسنس Mobilix کا نہیں'], licMachine: ['This license is for a different device', 'یہ لائسنس کسی اور ڈیوائس کا ہے'],
  licExpired: ['License has expired', 'لائسنس کی مدت ختم ہو گئی'], licClock: ['Device date/time is wrong, please correct it', 'ڈیوائس کی تاریخ/وقت غلط ہے، درست کریں'],
  licConfig: ['This build has no license key yet. Contact the developer.', 'اس ایپ میں ابھی لائسنس کی موجود نہیں۔ ڈویلپر سے رابطہ کریں۔'],
};

export const D: Record<string, [string, string]> = { ...D1, ...D2 };
