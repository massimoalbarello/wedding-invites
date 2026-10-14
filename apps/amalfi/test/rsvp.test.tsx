import { afterEach, expect, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RsvpForm } from '../src/rsvp-form';

afterEach(cleanup);

test('a guest without an allowance can reply without additional-guest controls', async () => {
  const user = userEvent.setup();
  render(
    <RsvpForm status="pending" companions={[]} maxGuests={0} onSave={() => Promise.resolve()} />,
  );
  await user.click(screen.getByRole('radio', { name: 'Yes, I’ll be there' }));
  expect(screen.queryByRole('button', { name: 'Add a guest' })).toBeNull();
});
