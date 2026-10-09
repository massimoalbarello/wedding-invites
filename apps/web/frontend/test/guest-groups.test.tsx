import { afterEach, expect, mock, test } from 'bun:test';
import { Button } from '@repo/ui/button';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { GuestForm } from '../src/components/guest-form';
import type { GuestDraft } from '../src/queries/guests';

const initial = { name: 'Alex Morgan', groupName: '', faceScanRequired: true, maxGuests: 0 };
const groups = ['Family', 'Friends'];
afterEach(cleanup);

test('the group picker joins an existing group or saves the guest as ungrouped', async () => {
  const user = userEvent.setup();
  const saves: GuestDraft[] = [];
  render(
    <GuestForm
      initial={initial}
      groups={groups}
      onCancel={() => {}}
      onSave={(value) => {
        saves.push(value);
        return Promise.resolve();
      }}
    />,
  );
  expect(screen.getByRole('combobox', { name: 'Group' }).textContent).toContain('Ungrouped');
  await user.click(screen.getByRole('combobox', { name: 'Group' }));
  await user.click(screen.getByRole('option', { name: 'Friends' }));
  expect(screen.queryByLabelText('New group name')).toBeNull();
  expect(saves).toEqual([]);
  await user.click(screen.getByRole('button', { name: 'Save guest' }));
  await waitFor(() => expect(saves.at(-1)?.groupName).toBe('Friends'));
  await user.click(screen.getByRole('combobox', { name: 'Group' }));
  await user.click(screen.getByRole('option', { name: 'Ungrouped' }));
  await user.click(screen.getByRole('button', { name: 'Save guest' }));
  await waitFor(() => expect(saves.at(-1)?.groupName).toBe(''));
});

test('creating a group validates its name on Save and can reuse an exact existing name', async () => {
  const user = userEvent.setup();
  const saves: GuestDraft[] = [];
  render(
    <GuestForm
      initial={initial}
      groups={groups}
      onCancel={() => {}}
      onSave={(value) => {
        saves.push(value);
        return Promise.resolve();
      }}
    />,
  );
  await user.click(screen.getByRole('combobox', { name: 'Group' }));
  await user.click(screen.getByRole('option', { name: 'Create a new group…' }));
  expect(screen.queryByRole('alert')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Save guest' }));
  expect(screen.getByRole('alert').textContent).toBe('Enter a name for the new group.');
  expect(saves).toEqual([]);
  await user.type(screen.getByLabelText('New group name'), 'Colleagues');
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  await user.click(screen.getByRole('button', { name: 'Save guest' }));
  await waitFor(() => expect(saves.at(-1)?.groupName).toBe('Colleagues'));
  await user.clear(screen.getByLabelText('New group name'));
  await user.type(screen.getByLabelText('New group name'), 'Friends');
  await user.click(screen.getByRole('button', { name: 'Save guest' }));
  await waitFor(() => expect(saves.at(-1)?.groupName).toBe('Friends'));
});

test('an existing group is selected during editing and Cancel discards the new group draft', async () => {
  const user = userEvent.setup();
  const save = mock(() => Promise.resolve());
  function Editor() {
    const [editing, setEditing] = useState(true);
    return editing ? (
      <GuestForm
        initial={{ ...initial, groupName: 'Family' }}
        groups={groups}
        onSave={save}
        onCancel={() => setEditing(false)}
      />
    ) : (
      <Button onClick={() => setEditing(true)}>Edit guest</Button>
    );
  }
  render(<Editor />);
  expect(screen.getByRole('combobox', { name: 'Group' }).textContent).toContain('Family');
  await user.click(screen.getByRole('combobox', { name: 'Group' }));
  await user.click(screen.getByRole('option', { name: 'Create a new group…' }));
  await user.type(screen.getByLabelText('New group name'), 'Neighbours');
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(save).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Edit guest' }));
  expect(screen.getByRole('combobox', { name: 'Group' }).textContent).toContain('Family');
  expect(screen.queryByLabelText('New group name')).toBeNull();
});
