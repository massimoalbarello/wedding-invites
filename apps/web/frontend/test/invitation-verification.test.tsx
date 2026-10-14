import { afterEach, expect, test } from 'bun:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { SecretScene } from '../src/routes/-invitation/secret-paper';
import { SelfDestruct } from '../src/routes/-invitation/self-destruct';

const COUNTDOWN_TIMEOUT_MS = 5000;
afterEach(cleanup);

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
