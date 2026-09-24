import test from 'node:test';
import assert from 'node:assert/strict';
import { posterDate, posterPages } from '../couple-poster.js';

test('uses Korea date and weekday across midnight and year boundaries', () => {
  assert.equal(posterDate(new Date('2026-09-23T15:00:00Z')).label, '9/24(목)');
  assert.equal(posterDate(new Date('2026-09-24T14:59:59Z')).label, '9/24(목)');
  assert.equal(posterDate(new Date('2026-09-24T15:00:00Z')).label, '9/25(금)');
  assert.deepEqual(posterDate(new Date('2026-12-31T15:00:00Z')), {label:'1/1(금)', filename:'2027-01-01'});
});
test('splits at four couples and preserves order without dropping or duplicating pairs', () => {
  for (const count of [0, 1, 4, 5, 9, 20]) {
    const couples = Array.from({length:count}, (_, i) => ({person1:`A${i}`,person2:`B${i}`}));
    const pages = posterPages(couples);
    assert.equal(pages.length, Math.ceil(count / 4));
    assert.ok(pages.every(page => page.length > 0 && page.length <= 4));
    assert.deepEqual(pages.flat(), couples);
  }
});
