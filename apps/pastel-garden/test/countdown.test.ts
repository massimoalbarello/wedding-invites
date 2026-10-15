import { expect, test } from 'bun:test';
import { daysUntilWedding } from '../src/countdown';

test('the countdown changes at the wedding date in Italy, regardless of viewer timezone', () => {
  expect(daysUntilWedding(new Date('2027-06-28T21:59:59Z'))).toBe(1);
  expect(daysUntilWedding(new Date('2027-06-28T22:00:00Z'))).toBe(0);
  expect(daysUntilWedding(new Date('2027-06-30T10:00:00Z'))).toBe(0);
});

test('calendar days stay whole across Italy’s daylight saving change', () => {
  const daysFromMarch28 = 93;
  expect(daysUntilWedding(new Date('2027-03-27T23:00:00Z'))).toBe(daysFromMarch28);
  expect(daysUntilWedding(new Date('2027-03-28T22:00:00Z'))).toBe(daysFromMarch28 - 1);
});
