import assert from 'node:assert/strict';
import { Fmt, waNumber } from '../src/lib/format';
import { CURRENCIES } from '../src/db/types';

const [PKR, AED, , USD] = CURRENCIES;
assert.equal(Fmt.money(1234567, PKR), 'Rs 1,234,567');
assert.equal(Fmt.money(0, PKR), 'Rs 0');
assert.equal(Fmt.money(-500, PKR), '-Rs 500');
assert.equal(Fmt.money(1234.5, AED), '1,234.50 AED');
assert.equal(Fmt.money(99.999, USD), '$ 100.00');
assert.equal(Fmt.money(-0.001, USD), '$ 0.00'); // no "-0.00"
assert.equal(Fmt.money(null, PKR), 'Rs 0');
assert.equal(Fmt.date('2026-11-12', 'en'), '12 November 2026');
assert.equal(Fmt.date('2026-11-12', 'en', true), '12 Nov 2026');
assert.equal(Fmt.date('', 'en'), '—');
assert.equal(waNumber('0300-1234567'), '923001234567');
assert.equal(waNumber('+92 300 1234567'), '923001234567');
assert.equal(waNumber('', '92'), '');
console.log('format tests passed');
