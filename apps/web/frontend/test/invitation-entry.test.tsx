import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
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
const REDIRECT_OBSERVATION_MS = 3200;
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
  verification?: () => Promise<Response>;
  entryStatus?: number;
}) {
  let sessionRequests = 0;
  let contentRequests = 0;
  let hasSession = input.entry.authenticated;
  spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(
      async (request: string | URL | Request) => {
        const url = String(request);
        if (url.endsWith('/verify')) {
          const response = await input.verification!();
          hasSession = response.ok;
          return response;
        }
        if (url.endsWith('/session')) {
          sessionRequests++;
          const response = await (input.session?.() ??
            Promise.resolve(Response.json({ authenticated: true })));
          hasSession = response.ok;
          return response;
        }
        if (url.endsWith('/content')) {
          contentRequests++;
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
  return {
    router,
    queryClient,
    sessionRequests: () => sessionRequests,
    contentRequests: () => contentRequests,
  };
}

async function captureSelfie() {
  const stream = new MediaStream();
  stream.getTracks = () => [];
  const mediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: () => Promise.resolve(stream) },
  });
  spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: () => {},
  } as unknown as CanvasRenderingContext2D);
  spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
    callback(new Blob(['photo'], { type: 'image/jpeg' }));
  });
  spyOn(URL, 'createObjectURL').mockReturnValue('blob:selfie');
  spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  try {
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Take a selfie & open' }));
    const video = screen.getByLabelText('Live front camera preview');
    Object.defineProperties(video, {
      videoWidth: { value: 640 },
      videoHeight: { value: 480 },
    });
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLButtonElement>('button', { name: 'Capture & verify' }).disabled,
      ).toBe(false),
    );
    await user.click(screen.getByRole('button', { name: 'Capture & verify' }));
    return user;
  } finally {
    if (mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', mediaDevices);
    } else {
      Reflect.deleteProperty(navigator, 'mediaDevices');
    }
  }
}

test('successful verification counts down for three seconds before opening the invitation', async () => {
  const view = renderEntry({
    entry: { name: content.name, faceScanRequired: true, authenticated: false },
    verification: () => Promise.resolve(Response.json({ authenticated: true })),
  });
  view.queryClient.setQueryData(invitationKeys.content('another-token'), content);
  await captureSelfie();
  await screen.findByRole('heading', { name: `It’s you, ${content.name}.` });
  expect(screen.getByRole('status').textContent).toContain('Opening your invitation in 3…');
  expect(view.queryClient.getQueryData(invitationKeys.content('another-token'))).toBeUndefined();
  for (const seconds of [2, 1]) {
    await waitFor(
      () => expect(screen.getByRole('status').textContent).toContain(`in ${seconds}…`),
      { timeout: 1500 },
    );
    expect(view.router.state.location.pathname).toBe(`/i/${token}`);
    expect(view.contentRequests()).toBe(0);
  }
  await screen.findByTitle('Invitation', {}, { timeout: 1500 });
  expect(view.router.state.location.pathname).toBe(`/i/${token}/invitation`);
  expect(view.contentRequests()).toBe(1);
  expect(view.sessionRequests()).toBe(0);
});

test('a verified guest can skip the countdown and leave without a delayed redirect', async () => {
  const view = renderEntry({
    entry: { name: content.name, faceScanRequired: true, authenticated: false },
    verification: () => Promise.resolve(Response.json({ authenticated: true })),
  });
  const user = await captureSelfie();
  const link = await screen.findByRole('link', { name: 'Open invitation' });
  expect(screen.getByRole('status').textContent).toContain('in 3…');
  await user.click(link);
  await screen.findByTitle('Invitation');
  expect(view.router.state.location.pathname).toBe(`/i/${token}/invitation`);
  const anotherToken = 'b'.repeat(TOKEN_LENGTH);
  await Promise.resolve(
    act(async () => {
      await view.router.navigate({ to: '/i/$token', params: { token: anotherToken } });
    }),
  );
  await screen.findByRole('button', { name: 'Take a selfie & open' });
  await Promise.resolve(
    act(async () => {
      await Bun.sleep(REDIRECT_OBSERVATION_MS);
    }),
  );
  expect(view.router.state.location.pathname).toBe(`/i/${anotherToken}`);
  expect(screen.queryByTitle('Invitation')).toBeNull();
});

test('a recoverable verification failure offers a retry without opening invitation content', async () => {
  const view = renderEntry({
    entry: { name: content.name, faceScanRequired: true, authenticated: false },
    verification: () =>
      Promise.resolve(Response.json({ error: 'No face found.' }, { status: 400 })),
  });
  await captureSelfie();
  expect((await screen.findByRole('alert')).textContent).toBe('No face found.');
  expect(screen.getByRole('button', { name: 'Try another photo' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Open invitation' })).toBeNull();
  expect(view.router.state.location.pathname).toBe(`/i/${token}`);
  expect(view.contentRequests()).toBe(0);
});

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
