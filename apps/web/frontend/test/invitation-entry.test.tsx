import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { api } from '../src/lib/api';
import { invitationKeys } from '../src/queries/invitations';
import { routeTree } from '../src/routeTree.gen';

type Entry = NonNullable<
  Awaited<ReturnType<ReturnType<typeof api.api.invitations>['get']>>['data']
>;
type Content = NonNullable<
  Awaited<ReturnType<ReturnType<typeof api.api.invitations>['content']['get']>>['data']
>;
const TOKEN_LENGTH = 48;
const OK = 200;
const token = 'a'.repeat(TOKEN_LENGTH);
const content: Content = {
  name: 'Alex Morgan',
  assetUrl: 'about:blank',
  status: 'pending',
  maxGuests: 1,
  companions: [],
};
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) {
    client.clear();
  }
  mock.restore();
});

function renderEntry(input: {
  entry: Entry;
  session?: () => Promise<Response>;
  entryStatus?: number;
}) {
  let sessionRequests = 0;
  let hasSession = input.entry.authenticated;
  spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(
      async (request: string | URL | Request) => {
        const url = String(request);
        if (url.endsWith('/session')) {
          sessionRequests++;
          const response = await (input.session?.() ??
            Promise.resolve(Response.json({ authenticated: true })));
          hasSession = response.ok;
          return response;
        }
        if (url.endsWith('/content')) {
          return hasSession
            ? Response.json(content)
            : Response.json({ error: 'Please verify your identity.' }, { status: 401 });
        }
        return Response.json(input.entry, { status: input.entryStatus ?? OK });
      },
      { preconnect: globalThis.fetch.preconnect },
    ),
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(queryClient);
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [`/i/${token}`] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient, sessionRequests: () => sessionRequests };
}

test.each([
  { faceScanRequired: false, authenticated: false, sessions: 1 },
  { faceScanRequired: false, authenticated: true, sessions: 0 },
  { faceScanRequired: true, authenticated: true, sessions: 0 },
])(
  'opens the invitation directly with faceScanRequired=$faceScanRequired and authenticated=$authenticated',
  async ({ faceScanRequired, authenticated, sessions }) => {
    const view = renderEntry({ entry: { name: content.name, faceScanRequired, authenticated } });
    await screen.findByTitle('Invitation');
    expect(view.router.state.location.pathname).toBe(`/i/${token}/invitation`);
    expect(view.sessionRequests()).toBe(sessions);
    expect(screen.queryByRole('button', { name: 'Open invitation' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Take a selfie & open' })).toBeNull();
  },
);

test('a guest with reference photos still needs selfie verification', async () => {
  const view = renderEntry({
    entry: { name: content.name, faceScanRequired: true, authenticated: false },
  });
  await screen.findByRole('button', { name: 'Take a selfie & open' });
  expect(view.router.state.location.pathname).toBe(`/i/${token}`);
  expect(view.sessionRequests()).toBe(0);
  expect(screen.queryByTitle('Invitation')).toBeNull();
});

test('direct access waits for a session without rendering the secret cover and clears old content', async () => {
  const { promise, resolve } = Promise.withResolvers<Response>();
  const view = renderEntry({
    entry: { name: content.name, faceScanRequired: false, authenticated: false },
    session: () => promise,
  });
  view.queryClient.setQueryData(invitationKeys.content(token), null);
  view.queryClient.setQueryData(invitationKeys.content('another-token'), content);
  await waitFor(() => expect(view.sessionRequests()).toBe(1));
  expect(screen.queryByRole('button', { name: 'Open invitation' })).toBeNull();
  expect(screen.queryByText('A personal invitation for')).toBeNull();
  expect(screen.queryByTitle('Invitation')).toBeNull();
  resolve(Response.json({ authenticated: true }));
  await screen.findByTitle('Invitation');
  expect(view.queryClient.getQueryData(invitationKeys.content('another-token'))).toBeUndefined();
  expect(view.queryClient.getQueryData<Content>(invitationKeys.content(token))).toEqual(content);
});

test.each([
  { entryStatus: 404, sessionStatus: 200, error: 'This personal link is unavailable.' },
  { entryStatus: 200, sessionStatus: 403, error: 'Could not open your invitation.' },
])(
  'failed entry or session opening shows the route error ($entryStatus/$sessionStatus)',
  async (input) => {
    renderEntry({
      entry: { name: content.name, faceScanRequired: false, authenticated: false },
      entryStatus: input.entryStatus,
      session: () =>
        Promise.resolve(Response.json({ error: 'Unavailable' }, { status: input.sessionStatus })),
    });
    await screen.findByRole('heading', { name: 'This message couldn’t be opened' });
    expect(screen.getByText(input.error, { exact: false })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByTitle('Invitation')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open invitation' })).toBeNull();
  },
);
