import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { FaceMismatchError, verifyFace } from '../src/queries/invitations';
import { SecretScene } from '../src/routes/-invitation/secret-paper';
import { SelfDestruct } from '../src/routes/-invitation/self-destruct';

const FORBIDDEN = 403;
const BAD_REQUEST = 400;
const UNAVAILABLE = 503;
const COUNTDOWN_TIMEOUT_MS = 5000;
afterEach(() => {
  cleanup();
  mock.restore();
});

test.each([
  {
    status: FORBIDDEN,
    body: { error: 'A different face.', reason: 'face_mismatch' },
    mismatch: true,
  },
  { status: FORBIDDEN, body: { error: 'Please take a fresh selfie.' }, mismatch: false },
  { status: BAD_REQUEST, body: { error: 'No face found.' }, mismatch: false },
  { status: UNAVAILABLE, body: { error: 'Please try again later.' }, mismatch: false },
])(
  'only an explicit face mismatch starts the terminal denial experience: $body.error',
  async ({ status, body, mismatch }) => {
    spyOn(globalThis, 'fetch').mockImplementation(
      Object.assign(() => Promise.resolve(Response.json(body, { status })), {
        preconnect: globalThis.fetch.preconnect,
      }),
    );
    const error = await verifyFace({
      token: 'personal-link',
      photo: new File(['selfie'], 'selfie.jpg'),
    }).catch((cause: unknown) => cause);
    expect(error instanceof FaceMismatchError).toBe(mismatch);
    expect(error).toBeInstanceOf(Error);
  },
);

test('a denied message counts down and leaves the page visually blank', async () => {
  const view = render(
    <SecretScene>
      <SelfDestruct />
    </SecretScene>,
  );
  expect(screen.getByRole('heading', { name: 'Sorry, this message isn’t for you.' })).toBeTruthy();
  expect(screen.getByRole('status').textContent).toBe('Self-destructing in 3…');
  await waitFor(
    () => expect(screen.getByRole('status').textContent).toBe('Self-destructing in 2…'),
    { timeout: COUNTDOWN_TIMEOUT_MS },
  );
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Message destroyed.'), {
    timeout: COUNTDOWN_TIMEOUT_MS,
  });
  expect(screen.queryByRole('heading')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
  expect(view.container.querySelector('section')).toBeNull();
});
