import { afterEach, expect, test } from 'bun:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { Countdown, timeUntilWedding } from '../src/countdown';

afterEach(cleanup);

test('the countdown targets the 5pm ceremony in Italy with second precision', () => {
  expect(timeUntilWedding(new Date('2027-06-28T13:57:56Z'))).toEqual({
    days: 1,
    hours: 1,
    minutes: 2,
    seconds: 4,
  });
  expect(timeUntilWedding(new Date('2027-06-29T16:59:59+02:00'))).toEqual({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 1,
  });
  expect(timeUntilWedding(new Date('2027-06-29T15:00:00Z'))).toEqual({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  expect(timeUntilWedding(new Date('2027-06-30T10:00:00Z'))).toEqual({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
});

test('a second stays visible until it fully elapses, including across Italy’s clock change', () => {
  expect(timeUntilWedding(new Date('2027-06-29T14:59:59.500Z')).seconds).toBe(1);
  const before = timeUntilWedding(new Date('2027-03-28T00:59:59Z'));
  const after = timeUntilWedding(new Date('2027-03-28T01:00:00Z'));
  expect(before).toEqual({ days: 93, hours: 14, minutes: 0, seconds: 1 });
  expect(after).toEqual({ ...before, seconds: 0 });
});

test('the displayed seconds tick without announcing each tick to assistive technology', async () => {
  render(<Countdown />);
  expect(screen.getByText('The countdown has begun')).toBeDefined();
  expect(screen.queryByText('Until we say “I do”')).toBeNull();
  expect(screen.queryByText(/5:00 pm/)).toBeNull();
  const clock = screen.getByLabelText('Time until our wedding');
  // Read the seconds cell rather than relying on the date the test is run.
  const seconds = screen.getByText('seconds').nextElementSibling!;
  const initial = seconds.textContent;
  await waitFor(() => expect(seconds.textContent).not.toBe(initial), { timeout: 2000 });
  expect(clock.getAttribute('aria-live')).toBe('off');
  expect(screen.queryByText('Counting calendar days in Italy.')).toBeNull();
  expect(screen.queryByRole('link', { name: /Send your reply/ })).toBeNull();
});
