import { afterEach, expect, test } from 'bun:test';
import type { InvitationRuntime } from '@repo/invitation-runtime/contract';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Invitation } from '../src/invitation';

afterEach(cleanup);

const context = {
  recipient: { name: 'Alex Rivera' },
  rsvp: { status: 'pending' as const, companions: [], maxAdditionalGuests: 0 },
};

function show(getContext: InvitationRuntime['getContext'] = async () => context) {
  const runtime: InvitationRuntime = { getContext, saveRsvp: async () => context.rsvp };
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Invitation runtime={runtime} />
    </QueryClientProvider>,
  );
}

test('opening is gated by recipient context and reveals live text without a skip control', async () => {
  let resolveContext!: (value: typeof context) => void;
  show(
    () =>
      new Promise((resolve) => {
        resolveContext = resolve;
      }),
  );
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  resolveContext(context);
  const open = await screen.findByRole('button', { name: 'Open invitation' });
  await userEvent.click(open);
  expect(screen.queryByRole('button', { name: 'Skip opening' })).toBeNull();
  expect(open.textContent).toBe('');
  expect((open as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(open);
  expect(screen.getByRole('status').textContent).toBe('Opening your invitation…');
  fireEvent.animationEnd(document.querySelector('.envelope-art')!, {
    animationName: 'envelope-depart',
  });
  const heading = screen.getByRole('heading', { name: 'Massimo & Lisa' });
  expect(document.activeElement).toBe(heading);
  expect(screen.queryByRole('button', { name: 'Open invitation' })).toBeNull();
  expect(screen.getAllByText('29 June 2027')[0]?.getAttribute('dateTime')).toBe('2027-06-29');
  expect(screen.getByRole('link', { name: 'Into the garden' }).getAttribute('href')).toBe('#venue');
});

test('inner light animation does not finish the opening before the envelope', async () => {
  show();
  await userEvent.click(await screen.findByRole('button', { name: 'Open invitation' }));
  fireEvent.animationEnd(document.querySelector('.envelope-glow')!, {
    animationName: 'letter-glow',
  });
  expect(screen.queryByRole('heading', { name: 'Massimo & Lisa' })).toBeNull();
  expect(screen.getByRole('status').textContent).toBe('Opening your invitation…');
  fireEvent.animationEnd(document.querySelector('.envelope-art')!, {
    animationName: 'envelope-depart',
  });
  expect(screen.getByRole('heading', { name: 'Massimo & Lisa' })).toBeDefined();
});

test('reduced motion opens immediately without the opening stage', async () => {
  const original = window.matchMedia;
  window.matchMedia = (query) => {
    const media = original.call(window, query);
    Object.defineProperty(media, 'matches', { value: true });
    return media;
  };
  try {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Open invitation' }));
    expect(screen.queryByRole('button', { name: 'Skip opening' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Massimo & Lisa' })).toBeDefined();
  } finally {
    window.matchMedia = original;
  }
});

test('failed connection offers a retry before opening', async () => {
  let attempt = 0;
  show(() => {
    if (attempt++ === 0) {
      return Promise.reject(new Error('Open your personal link again.'));
    }
    return Promise.resolve(context);
  });
  expect((await screen.findByRole('alert')).textContent).toBe('Open your personal link again.');
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('A letter for Alex Rivera')).toBeDefined();
  expect(
    (screen.getByRole('button', { name: 'Open invitation' }) as HTMLButtonElement).disabled,
  ).toBe(false);
});
