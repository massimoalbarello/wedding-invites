import { afterEach, expect, test } from 'bun:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuestForm } from '../src/components/guest-form';
import type { GuestDraft } from '../src/queries/guests';

afterEach(cleanup);
test('a guest requires a name and saves the per-person access choices', async () => {
  const user = userEvent.setup();
  const saves: GuestDraft[] = [];
  render(
    <GuestForm
      initial={{ name: '', groupName: '', faceScanRequired: true, maxGuests: 0 }}
      onCancel={() => {}}
      onSave={(value) => {
        saves.push(value);
        return Promise.resolve();
      }}
    />,
  );
  expect(screen.queryByRole('alert')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Save guest' }));
  expect(screen.getByRole('alert').textContent).toContain('Enter the guest’s name');
  expect(saves).toEqual([]);
  await user.type(screen.getByLabelText('Full name'), 'Alex Morgan');
  await user.click(screen.getByRole('switch', { name: 'Require a face scan' }));
  expect(
    screen.getByText('Anyone with this personal link can open the invitation directly.'),
  ).toBeTruthy();
  await user.clear(screen.getByLabelText('Additional guests allowed'));
  await user.type(screen.getByLabelText('Additional guests allowed'), '2');
  await user.click(screen.getByRole('button', { name: 'Save guest' }));
  await waitFor(() =>
    expect(saves).toEqual([
      {
        name: 'Alex Morgan',
        groupName: '',
        faceScanRequired: false,
        maxGuests: 2,
        photos: [],
        removedPhotoIds: [],
      },
    ]),
  );
});
