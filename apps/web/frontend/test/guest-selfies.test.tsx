import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { api } from '../src/lib/api';
import { captureUrl, type Guest, guestKeys } from '../src/queries/guests';
import { routeTree } from '../src/routeTree.gen';

type Captures = NonNullable<
  Awaited<ReturnType<ReturnType<typeof api.api.admin.guests>['captures']['get']>>['data']
>;
const ID_LENGTH = 48;
const INTERNAL_ERROR = 500;
const guest: Guest = {
  id: crypto.randomUUID(),
  name: 'Alex Morgan',
  groupName: 'Friends',
  maxGuests: 0,
  status: 'pending',
  active: true,
  faceScanRequired: true,
  token: 'a'.repeat(ID_LENGTH),
  createdAt: '2026-10-15T10:00:00.000Z',
  companions: [],
  references: [{ id: 'd'.repeat(ID_LENGTH), createdAt: '2026-10-15T10:00:00.000Z' }],
  activity: {
    linkOpenedAt: null,
    verificationFailedAt: null,
    verifiedAt: null,
    invitationOpenedAt: null,
  },
};
const newest = { id: 'b'.repeat(ID_LENGTH), createdAt: '2026-10-15T12:00:00.000Z' };
const older = { id: 'c'.repeat(ID_LENGTH), createdAt: '2026-10-14T12:00:00.000Z' };
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) {
    client.clear();
  }
  mock.restore();
});

function renderProfile(captures: (url: URL) => Promise<Response>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(queryClient);
  queryClient.setQueryDefaults(['session'], { staleTime: Infinity });
  queryClient.setQueryData(['session'], { user: { id: 'owner' }, session: {} });
  queryClient.setQueryData(guestKeys.detail({ ownerId: 'owner', id: guest.id }), guest);
  queryClient.setQueryData([...guestKeys.owner('owner'), 'groups'], ['Friends']);
  spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(
      async (request: string | URL | Request) => {
        const url = new URL(String(request), 'http://localhost');
        if (url.pathname.endsWith('/captures')) {
          return await captures(url);
        }
        if (url.pathname.endsWith('/get-session')) {
          return Response.json({ user: { id: 'owner' }, session: {} });
        }
        if (url.pathname.endsWith('/groups')) {
          return Response.json(['Friends']);
        }
        if (url.pathname.endsWith(`/guests/${guest.id}`)) {
          return Response.json(guest);
        }
        throw new Error(`Unexpected request: ${url.pathname}`);
      },
      { preconnect: globalThis.fetch.preconnect },
    ),
  );
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [`/guests/${guest.id}`] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return queryClient;
}
function response(data: Captures) {
  return Promise.resolve(Response.json(data));
}

test('the profile shows dated guest selfies, opens originals, and loads older submissions', async () => {
  const user = userEvent.setup();
  renderProfile((url) =>
    response(
      url.searchParams.has('cursor')
        ? { items: [older], nextCursor: null }
        : { items: [newest], nextCursor: newest.id },
    ),
  );
  const gallery = await screen.findByRole('region', { name: 'Selfies' });
  await within(gallery).findByRole('img', { name: 'Selfie for Alex Morgan' });
  expect(within(gallery).getByRole('link').getAttribute('href')).toBe(
    captureUrl({ id: guest.id, captureId: newest.id }),
  );
  expect(within(gallery).getByText(new Date(newest.createdAt).toLocaleString())).toBeTruthy();
  await user.click(within(gallery).getByRole('button', { name: 'Load older selfies' }));
  await waitFor(() => expect(within(gallery).getAllByRole('img')).toHaveLength(2));
  expect(
    within(gallery)
      .getAllByRole('img')
      .map((img) => img.getAttribute('src')),
  ).toEqual([newest, older].map((photo) => captureUrl({ id: guest.id, captureId: photo.id })));
  expect(within(gallery).queryByRole('button', { name: 'Load older selfies' })).toBeNull();
});

test('loading and empty selfies leave the guest profile usable', async () => {
  const pending = Promise.withResolvers<Response>();
  renderProfile(() => pending.promise);
  expect(await screen.findByRole('heading', { name: guest.name })).toBeTruthy();
  expect((await screen.findByRole('status')).textContent).toBe('Loading selfies…');
  pending.resolve(Response.json({ items: [], nextCursor: null } satisfies Captures));
  expect(await screen.findByText(/No selfies yet/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Edit guest' })).toBeTruthy();
});

test('cancelling and reopening guest editing keeps one form and preserves the selfie gallery', async () => {
  const user = userEvent.setup();
  renderProfile(() => response({ items: [newest], nextCursor: null }));
  await screen.findByRole('img', { name: 'Selfie for Alex Morgan' });
  for (const draft of ['Unsaved name', 'Another draft']) {
    await user.click(screen.getByRole('button', { name: 'Edit guest' }));
    expect(screen.getAllByLabelText('Upload reference photos')).toHaveLength(1);
    const name = screen.getByRole('textbox', { name: 'Full name' }) as HTMLInputElement;
    expect(name.value).toBe(guest.name);
    await user.clear(name);
    await user.type(name, draft);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Upload reference photos')).toBeNull();
    expect(screen.getByRole('img', { name: 'Selfie for Alex Morgan' })).toBeTruthy();
  }
});

test('failed selfie requests can be retried without losing loaded photos', async () => {
  const user = userEvent.setup();
  let fail = true;
  renderProfile((url) => {
    if (!url.searchParams.has('cursor')) {
      return response({ items: [newest], nextCursor: newest.id });
    }
    if (fail) {
      return Promise.resolve(Response.json({ error: 'Unavailable' }, { status: INTERNAL_ERROR }));
    }
    return response({ items: [older], nextCursor: null });
  });
  await user.click(await screen.findByRole('button', { name: 'Load older selfies' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Could not load selfies. Try again.');
  expect(screen.getByRole('img', { name: 'Selfie for Alex Morgan' })).toBeTruthy();
  fail = false;
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() =>
    expect(screen.getAllByRole('img', { name: 'Selfie for Alex Morgan' })).toHaveLength(2),
  );
  expect(screen.queryByRole('alert')).toBeNull();
});

test('an initial gallery failure recovers to the empty state', async () => {
  const user = userEvent.setup();
  let fail = true;
  renderProfile(() =>
    fail
      ? Promise.resolve(Response.json({ error: 'Unavailable' }, { status: INTERNAL_ERROR }))
      : response({ items: [], nextCursor: null }),
  );
  await screen.findByRole('alert');
  expect(screen.getByRole('heading', { name: guest.name })).toBeTruthy();
  fail = false;
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText(/No selfies yet/)).toBeTruthy();
});
