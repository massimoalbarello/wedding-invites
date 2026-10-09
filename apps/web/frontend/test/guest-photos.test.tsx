import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { Button } from '@repo/ui/button';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MAX_PHOTO_BYTES, MAX_REFERENCE_PHOTOS } from '#backend/models/invitations/model.ts';
import { GuestForm } from '../src/components/guest-form';
import type { GuestDraft } from '../src/queries/guests';

const initial = { name: 'Alex Morgan', groupName: 'Friends', faceScanRequired: true, maxGuests: 0 };
const references = [
  { id: 'existing-reference', src: '/api/admin/guests/alex/photos/existing-reference' },
];
afterEach(() => {
  cleanup();
  mock.restore();
});
function mockPreviews() {
  spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:${crypto.randomUUID()}`);
  return spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
}
test('photo additions and removals stay in the draft until one Save guest submits them together', async () => {
  mockPreviews();
  const user = userEvent.setup();
  const saves: GuestDraft[] = [];
  render(
    <GuestForm
      initial={initial}
      references={references}
      onCancel={() => {}}
      onSave={(value) => {
        saves.push(value);
        return Promise.resolve();
      }}
    />,
  );
  const first = new File(['first'], 'first.png', { type: 'image/png' });
  const second = new File(['second'], 'second.png', { type: 'image/png' });
  const selected = [first, second];
  await user.upload(screen.getByLabelText('Upload reference photos'), selected);
  expect(screen.getAllByRole('img')).toHaveLength(references.length + selected.length);
  await user.click(screen.getByRole('button', { name: 'Remove reference photo 1' }));
  await user.click(screen.getByRole('button', { name: 'Remove reference photo 2' }));
  expect(screen.getAllByRole('img')).toHaveLength(1);
  expect(screen.getByText('Avatar')).toBeTruthy();
  expect(saves).toEqual([]);
  await user.click(screen.getByRole('button', { name: 'Save guest' }));
  await waitFor(() =>
    expect(saves).toEqual([
      { ...initial, photos: [first], removedPhotoIds: ['existing-reference'] },
    ]),
  );
});
test('cancelling an edit discards selected photos, restores persisted references, and releases previews', async () => {
  const revoke = mockPreviews();
  const user = userEvent.setup();
  const save = mock(() => Promise.resolve());
  function Editor() {
    const [editing, setEditing] = useState(true);
    return editing ? (
      <GuestForm
        initial={initial}
        references={references}
        onCancel={() => setEditing(false)}
        onSave={save}
      />
    ) : (
      <Button onClick={() => setEditing(true)}>Edit guest</Button>
    );
  }
  render(<Editor />);
  await user.upload(
    screen.getByLabelText('Upload reference photos'),
    new File(['new'], 'new.png', { type: 'image/png' }),
  );
  await user.click(screen.getByRole('button', { name: 'Remove reference photo 1' }));
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(save).not.toHaveBeenCalled();
  expect(revoke).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'Edit guest' }));
  expect(screen.getAllByRole('img')).toHaveLength(1);
  expect(screen.getByRole('img', { name: 'Reference 1 for Alex Morgan' }).getAttribute('src')).toBe(
    references[0]!.src,
  );
});
test('photo limits are shown after Save and recover when oversized or excess files are removed', async () => {
  mockPreviews();
  const user = userEvent.setup();
  const save = mock(() => Promise.resolve());
  render(<GuestForm initial={initial} onCancel={() => {}} onSave={save} />);
  const excess = Array.from(
    { length: MAX_REFERENCE_PHOTOS + 1 },
    () => new File(['photo'], `${crypto.randomUUID()}.png`, { type: 'image/png' }),
  );
  await user.upload(screen.getByLabelText('Upload reference photos'), excess);
  expect(screen.queryByRole('alert')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Save guest' }));
  expect(screen.getByRole('alert').textContent).toContain('Choose up to 8 reference photos');
  expect(save).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole('button', { name: `Remove reference photo ${MAX_REFERENCE_PHOTOS + 1}` }),
  );
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  for (const file of excess.slice(0, MAX_REFERENCE_PHOTOS)) {
    void file;
    await user.click(screen.getByRole('button', { name: 'Remove reference photo 1' }));
  }
  const oversized = new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], 'large.png', {
    type: 'image/png',
  });
  await user.upload(screen.getByLabelText('Upload reference photos'), oversized);
  expect(screen.getByRole('alert').textContent).toContain('8 MB or smaller');
  await user.click(screen.getByRole('button', { name: 'Save guest' }));
  expect(save).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Remove reference photo 1' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
});
