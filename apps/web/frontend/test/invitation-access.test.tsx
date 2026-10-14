import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { api } from '../src/lib/api';
import { invitationKeys } from '../src/queries/invitations';
import { routeTree } from '../src/routeTree.gen';

type Invitation = NonNullable<
  Awaited<ReturnType<ReturnType<typeof api.api.invitations>['content']['get']>>['data']
>;
const UNAUTHORIZED = 401;
const TOKEN_LENGTH = 48;
afterEach(() => {
  cleanup();
  mock.restore();
});
test('background revocation removes protected invitation content and its RSVP form from view and cache', async () => {
  const content: Invitation = {
    name: 'Alex Morgan',
    coupleNames: 'Avery & Jordan',
    date: '2030-09-21',
    status: 'pending',
    maxGuests: 1,
    companions: [],
  };
  let revoked = false;
  const fetchResponse = Object.assign(
    () =>
      Promise.resolve(
        revoked
          ? Response.json({ error: 'Please verify your identity.' }, { status: UNAUTHORIZED })
          : Response.json(content),
      ),
    { preconnect: globalThis.fetch.preconnect },
  );
  spyOn(globalThis, 'fetch').mockImplementation(fetchResponse);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const token = 'a'.repeat(TOKEN_LENGTH);
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [`/i/${token}/invitation`] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { name: 'Avery & Jordan' });
  expect(screen.getByRole('button', { name: 'Send reply' })).toBeTruthy();
  revoked = true;
  await Promise.resolve(
    act(async () => {
      await queryClient.invalidateQueries({ queryKey: invitationKeys.content(token) });
    }),
  );
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Avery & Jordan' })).toBeNull());
  expect(screen.queryByRole('button', { name: 'Send reply' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Open personal link' })).toBeTruthy();
  expect(queryClient.getQueryData(invitationKeys.content(token))).toBeNull();
  queryClient.clear();
});

test('an unconfigured wedding shows a neutral not-ready page without RSVP controls', async () => {
  const CONFLICT = 409;
  const fetchResponse = Object.assign(
    () =>
      Promise.resolve(
        Response.json({ error: 'Wedding details have not been set.' }, { status: CONFLICT }),
      ),
    { preconnect: globalThis.fetch.preconnect },
  );
  spyOn(globalThis, 'fetch').mockImplementation(fetchResponse);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const token = 'b'.repeat(TOKEN_LENGTH);
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [`/i/${token}/invitation`] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { name: 'This invitation is not ready yet.' });
  expect(screen.getByText('Please try again later.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Send reply' })).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Avery & Jordan' })).toBeNull();
  queryClient.clear();
});
