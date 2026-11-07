import { afterEach, expect, test } from 'bun:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuestForm } from '../src/components/guest-form';
import type { GuestDraft } from '../src/queries/guests';

afterEach(cleanup);
test('a guest requires a name and saves their additional guest allowance', async () => {
  const user = userEvent.setup();
  const saves: GuestDraft[] = [];
  render(
    <GuestForm
      initial={{ firstName: '', lastName: '', groupName: '', maxGuests: 0 }}
      onCancel={() => {}}
      onSave={(value) => {
        saves.push(value);
        return Promise.resolve();
      }}
    />,
  );
  expect(
    screen.getByText('Without reference photos, this invitation opens directly.'),
  ).toBeTruthy();
  expect(screen.queryByRole('switch')).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Save guest' }));
  expect(screen.getByRole('alert').textContent).toContain('Enter the guest’s first name');
  expect(saves).toEqual([]);
  await user.type(screen.getByLabelText('First name'), 'Alex');
  await user.type(screen.getByLabelText('Surname'), 'Morgan');
  await user.clear(screen.getByLabelText('Additional guests allowed'));
  await user.type(screen.getByLabelText('Additional guests allowed'), '2');
  await user.click(screen.getByRole('button', { name: 'Save guest' }));
  await waitFor(() =>
    expect(saves).toEqual([
      {
        firstName: 'Alex',
        lastName: 'Morgan',
        groupName: '',
        maxGuests: 2,
        photos: [],
        removedPhotoIds: [],
      },
    ]),
  );
});
