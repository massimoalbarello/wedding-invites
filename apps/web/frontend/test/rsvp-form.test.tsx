import { afterEach, expect, test } from 'bun:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RsvpForm } from '../src/routes/-invitation/rsvp-form';

afterEach(cleanup);
test('RSVP requires a reply and names each additional guest within the allowance', async () => {
  const user = userEvent.setup();
  const replies: { status: 'accepted' | 'declined'; companions: string[] }[] = [];
  render(
    <RsvpForm
      status="pending"
      companions={[]}
      maxGuests={1}
      onSave={(reply) => {
        replies.push(reply);
        return Promise.resolve();
      }}
    />,
  );
  expect(screen.queryByRole('alert')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Send reply' }));
  expect(screen.getByRole('alert').textContent).toContain('Choose a reply');
  await user.click(screen.getByRole('radio', { name: 'Yes, I’ll be there' }));
  await user.click(screen.getByRole('button', { name: '+ Add a guest' }));
  expect(screen.queryByRole('button', { name: '+ Add a guest' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Send reply' }));
  expect(screen.getByRole('alert').textContent).toContain('Add a name');
  expect(replies).toEqual([]);
  await user.type(screen.getByLabelText('Guest 1 name'), 'Jamie Morgan');
  await user.click(screen.getByRole('button', { name: 'Send reply' }));
  await waitFor(() =>
    expect(replies).toEqual([{ status: 'accepted', companions: ['Jamie Morgan'] }]),
  );
});
test('changing an accepted RSVP to declined removes companions from the submitted reply', async () => {
  const user = userEvent.setup();
  const replies: { status: 'accepted' | 'declined'; companions: string[] }[] = [];
  render(
    <RsvpForm
      status="accepted"
      companions={[{ name: 'Jamie Morgan' }]}
      maxGuests={1}
      onSave={(reply) => {
        replies.push(reply);
        return Promise.resolve();
      }}
    />,
  );
  await user.click(screen.getByRole('radio', { name: 'Sorry, I can’t make it' }));
  expect(screen.queryByLabelText('Guest 1 name')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Update reply' }));
  await waitFor(() => expect(replies).toEqual([{ status: 'declined', companions: [] }]));
});
