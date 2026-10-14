import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
const FORBIDDEN = 403;
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;
const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
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
  if (originalMediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
  } else {
    Reflect.deleteProperty(navigator, 'mediaDevices');
  }
});

function renderEntry(input: {
  entry: Entry;
  session?: () => Promise<Response>;
  verify?: () => Promise<Response>;
  entryStatus?: number;
}) {
  let sessionRequests = 0;
  let hasSession = input.entry.authenticated;
  spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(
      async (request: string | URL | Request) => {
        const url = String(request);
        if (url.endsWith('/verify') && input.verify) {
          const response = await input.verify();
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

async function captureSelfie() {
  const stream = new MediaStream();
  stream.getTracks = () => [];
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
  spyOn(URL, 'createObjectURL').mockReturnValue('blob:captured-selfie');
  spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Take a selfie & open' }));
  const video = screen.getByLabelText<HTMLVideoElement>('Live front camera preview');
  Object.defineProperties(video, {
    videoWidth: { value: VIDEO_WIDTH },
    videoHeight: { value: VIDEO_HEIGHT },
  });
  await waitFor(() =>
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Capture & verify' }).disabled,
    ).toBe(false),
  );
  await user.click(screen.getByRole('button', { name: 'Capture & verify' }));
}

test('successful verification opens the invitation immediately and clears pre-verification content', async () => {
  const { promise, resolve } = Promise.withResolvers<Response>();
  const view = renderEntry({
    entry: { name: content.name, faceScanRequired: true, authenticated: false },
    verify: () => promise,
  });
  await screen.findByRole('button', { name: 'Take a selfie & open' });
  view.queryClient.setQueryData(invitationKeys.content(token), null);
  view.queryClient.setQueryData(invitationKeys.content('another-token'), content);
  await captureSelfie();
  await screen.findByRole('status');
  expect(screen.queryByTitle('Invitation')).toBeNull();
  resolve(Response.json({ authenticated: true }));
  await screen.findByTitle('Invitation');
  expect(view.router.state.location.pathname).toBe(`/i/${token}/invitation`);
  expect(screen.queryByRole('button', { name: 'Open invitation' })).toBeNull();
  expect(screen.queryByText(`It’s you, ${content.name}.`)).toBeNull();
  expect(view.sessionRequests()).toBe(0);
  expect(view.queryClient.getQueryData(invitationKeys.content('another-token'))).toBeUndefined();
  expect(view.queryClient.getQueryData<Content>(invitationKeys.content(token))).toEqual(content);
});

test('a face mismatch keeps the guest on the entry route for self-destruction', async () => {
  const view = renderEntry({
    entry: { name: content.name, faceScanRequired: true, authenticated: false },
    verify: () =>
      Promise.resolve(
        Response.json(
          { error: 'A different face.', reason: 'face_mismatch' },
          { status: FORBIDDEN },
        ),
      ),
  });
  await captureSelfie();
  await screen.findByRole('heading', { name: 'Sorry, this message isn’t for you.' });
  expect(screen.getByRole('status').textContent).toBe('Self-destructing in 3…');
  expect(view.router.state.location.pathname).toBe(`/i/${token}`);
  expect(screen.queryByTitle('Invitation')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
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
