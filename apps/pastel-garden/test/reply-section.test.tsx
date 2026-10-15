import { afterEach, expect, test } from 'bun:test';
import type { InvitationContext, InvitationRuntime } from '@repo/invitation-runtime/contract';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReplySection } from '../src/reply-section';

afterEach(cleanup);
const context: InvitationContext = {
  recipient: { name: 'Alex Rivera' },
  rsvp: { status: 'pending', companions: [], maxAdditionalGuests: 1 },
};

function show({
  saveRsvp,
  allowance = 1,
}: {
  saveRsvp: InvitationRuntime['saveRsvp'];
  allowance?: number;
}) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReplySection
        runtime={{ getContext: async () => context, saveRsvp }}
        context={{ ...context, rsvp: { ...context.rsvp, maxAdditionalGuests: allowance } }}
      />
    </QueryClientProvider>,
  );
}

test('failed RSVP keeps the companion draft so the guest can retry', async () => {
  let attempt = 0;
  show({
    saveRsvp: (reply) => {
      if (attempt++ === 0) {
        return Promise.reject(new Error('Please try again.'));
      }
      expect(reply).toEqual({ status: 'accepted', companions: ['Casey Rivera'] });
      return Promise.resolve({ ...context.rsvp, ...reply });
    },
  });
  const user = userEvent.setup();
  await user.click(screen.getByRole('radio', { name: 'Yes, I’ll be there' }));
  await user.click(screen.getByRole('button', { name: '+ Add a guest' }));
  await user.type(screen.getByLabelText('Guest 1 name'), 'Casey Rivera');
  await user.click(screen.getByRole('button', { name: 'Send reply' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Please try again.');
  expect((screen.getByLabelText('Guest 1 name') as HTMLInputElement).value).toBe('Casey Rivera');
  await user.click(screen.getByRole('button', { name: 'Send reply' }));
  expect((await screen.findByRole('status')).textContent).toContain('Your reply is saved');
});

test('a guest without an allowance can reply without companion controls', async () => {
  show({ saveRsvp: (reply) => Promise.resolve({ ...context.rsvp, ...reply }), allowance: 0 });
  const user = userEvent.setup();
  await user.click(screen.getByRole('radio', { name: 'Yes, I’ll be there' }));
  expect(screen.queryByRole('button', { name: '+ Add a guest' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Send reply' }));
  expect((await screen.findByRole('status')).textContent).toContain('Your reply is saved');
});

test('guest guidance appears only with Yes and disappears again with No', async () => {
  show({ saveRsvp: (reply) => Promise.resolve({ ...context.rsvp, ...reply }) });
  const guidance = /We’re keeping our celebration close/;
  expect(screen.queryByText(guidance)).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Who’s coming with you?' })).toBeNull();
  const user = userEvent.setup();
  await user.click(screen.getByRole('radio', { name: 'Yes, I’ll be there' }));
  expect(screen.getByText(guidance)).toBeDefined();
  await user.click(screen.getByRole('radio', { name: 'Sorry, I can’t make it' }));
  expect(screen.queryByText(guidance)).toBeNull();
  expect(screen.queryByRole('button', { name: '+ Add a guest' })).toBeNull();
});

test('petals celebrate a saved acceptance, never a draft, failure, or decline', async () => {
  let fail = true;
  show({
    saveRsvp: (reply) =>
      fail
        ? Promise.reject(new Error('Please try again.'))
        : Promise.resolve({ ...context.rsvp, ...reply }),
  });
  const user = userEvent.setup();
  await user.click(screen.getByRole('radio', { name: 'Yes, I’ll be there' }));
  expect(document.querySelector('.petal-celebration')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Send reply' }));
  await screen.findByRole('alert');
  expect(document.querySelector('.petal-celebration')).toBeNull();
  fail = false;
  await user.click(screen.getByRole('button', { name: 'Send reply' }));
  await screen.findByRole('status');
  expect(document.querySelector('.petal-celebration')).not.toBeNull();
  await user.click(screen.getByRole('radio', { name: 'Sorry, I can’t make it' }));
  await user.click(screen.getByRole('button', { name: 'Send reply' }));
  expect((await screen.findByRole('status')).textContent).toBe('Thank you for letting us know.');
  expect(document.querySelector('.petal-celebration')).toBeNull();
});
