import { afterEach, expect, test } from 'bun:test';
import type { InvitationRuntime } from '@repo/invitation-runtime/contract';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { content } from '../src/content';
import { Invitation } from '../src/invitation';

afterEach(cleanup);

const context = {
  recipient: { name: 'Alex Rivera' },
  rsvp: { status: 'pending' as const, companions: [], maxAdditionalGuests: 0 },
};

const MID_STORY_SECONDS = 12;
const PLAYBACK_RECOVERY_DEADLINE_MS = 9500;
const RECOVERY_TEST_TIMEOUT_MS = 12000;

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

test('recipient access gates the film, whose ending reveals the live invitation', async () => {
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
  const mountedHeading = document.querySelector<HTMLHeadingElement>('.hero h1')!;
  expect(mountedHeading).not.toBeNull();
  expect(document.querySelector('.letter')?.hasAttribute('inert')).toBe(true);
  await userEvent.click(open);
  expect(screen.queryByRole('button', { name: 'Open invitation' })).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Massimo & Elizaveta' })).toBeNull();
  expect(screen.getByRole('status').textContent).toBe('Our story is playing…');
  expect(screen.queryByRole('button')).toBeNull();
  const video = document.querySelector('video')!;
  expect(video.loop).toBe(false);
  expect(video.controls).toBe(false);
  expect(video.muted).toBe(false);
  fireEvent.ended(video);
  const heading = screen.getByRole('heading', { name: 'Massimo & Elizaveta' });
  expect(heading).toBe(mountedHeading);
  expect(document.querySelector('.letter')?.hasAttribute('inert')).toBe(false);
  expect(document.activeElement).toBe(heading);
  expect(document.querySelector('video')).toBeNull();
  expect(
    screen.getByRole('img', { name: /Massimo and Elizaveta together/ }).getAttribute('src'),
  ).toBe('./media/landing-couple.webp');
  expect(document.querySelector('.hero')?.textContent).toContain('invite you to their wedding');
  expect(document.querySelector('.hero time')).toBeNull();
  expect(document.querySelector('.hero')?.textContent).not.toContain(content.venue);
  expect(screen.getAllByText('29 June 2027')[0]?.getAttribute('dateTime')).toBe('2027-06-29');
  expect(screen.getByRole('heading', { name: 'We’re counting the days' })).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Celebrate with us' })).toBeDefined();
});

test('the live artwork is decoded before the intro can reveal it', async () => {
  const decode = HTMLImageElement.prototype.decode;
  let decoded!: () => void;
  HTMLImageElement.prototype.decode = () =>
    new Promise<void>((resolve) => {
      decoded = resolve;
    });
  try {
    show();
    await screen.findByText('A letter for Alex Rivera');
    const open = screen.getByRole('button', { name: 'Open invitation' }) as HTMLButtonElement;
    expect(open.disabled).toBe(true);
    decoded();
    await waitFor(() => expect(open.disabled).toBe(false));
    await userEvent.click(open);
    fireEvent.ended(document.querySelector('video')!);
    expect(screen.getByRole('heading', { name: content.nameLabel })).toBeDefined();
  } finally {
    HTMLImageElement.prototype.decode = decode;
  }
});

test('changing landing content leaves the independent intro media unchanged', async () => {
  const previous = { ...content };
  Object.assign(content, {
    names: ['New', 'Names'],
    nameLabel: 'New & Names',
    dateLabel: '1 July 2030',
    venue: 'Another garden',
  });
  try {
    show();
    const open = (await screen.findByRole('button', {
      name: 'Open invitation',
    })) as HTMLButtonElement;
    await waitFor(() => expect(open.disabled).toBe(false));
    expect(document.querySelector('video')?.getAttribute('src')).toBe(
      './media/our-story-opening.mp4',
    );
    expect(document.querySelector('video')?.parentElement?.textContent).toBe('');
    await userEvent.click(open);
    fireEvent.ended(document.querySelector('video')!);
    expect(screen.getByRole('heading', { name: 'New & Names' })).toBeDefined();
    expect(screen.getAllByText('Another garden').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1 July 2030').length).toBeGreaterThan(0);
  } finally {
    Object.assign(content, previous);
  }
});

test('progress beyond the old envelope duration does not interrupt the story', async () => {
  show();
  await userEvent.click(await screen.findByRole('button', { name: 'Open invitation' }));
  const video = document.querySelector('video')!;
  video.currentTime = MID_STORY_SECONDS;
  fireEvent.timeUpdate(video);
  expect(screen.queryByRole('heading', { name: 'Massimo & Elizaveta' })).toBeNull();
  fireEvent.ended(video);
  expect(screen.getByRole('heading', { name: 'Massimo & Elizaveta' })).toBeDefined();
});

test('audio autoplay rejection retries silently rather than losing the story', async () => {
  const play = HTMLMediaElement.prototype.play;
  let blocked = true;
  HTMLMediaElement.prototype.play = () => {
    if (blocked) {
      blocked = false;
      return Promise.reject(new Error('Sound needs a gesture.'));
    }
    return Promise.resolve();
  };
  try {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Open invitation' }));
    await waitFor(() => expect(document.querySelector('video')?.muted).toBe(true));
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Massimo & Elizaveta' })).toBeNull();
  } finally {
    HTMLMediaElement.prototype.play = play;
  }
});

test('a video failure still grants access to the live invitation', async () => {
  show();
  await userEvent.click(await screen.findByRole('button', { name: 'Open invitation' }));
  fireEvent.error(document.querySelector('video')!);
  expect(screen.getByRole('heading', { name: 'Massimo & Elizaveta' })).toBeDefined();
  expect(document.querySelector('video')).toBeNull();
});

test('pausing a pending play request does not restart playback or skip the film', async () => {
  const play = HTMLMediaElement.prototype.play;
  const playback = Promise.withResolvers<void>();
  HTMLMediaElement.prototype.play = () => playback.promise;
  try {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Open invitation' }));
    fireEvent.pause(document.querySelector('video')!);
    await Promise.resolve(
      act(() => {
        playback.reject(new DOMException('Playback was paused.', 'AbortError'));
        return Promise.resolve();
      }),
    );
    expect(document.querySelector('video')).not.toBeNull();
    expect(document.querySelector('video')?.muted).toBe(false);
    expect(screen.queryByRole('heading', { name: 'Massimo & Elizaveta' })).toBeNull();
  } finally {
    HTMLMediaElement.prototype.play = play;
  }
});

test(
  'a stalled film recovers to the invitation without waiting for its full duration',
  async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Open invitation' }));
    fireEvent.waiting(document.querySelector('video')!);
    const heading = await screen.findByRole(
      'heading',
      { name: 'Massimo & Elizaveta' },
      { timeout: PLAYBACK_RECOVERY_DEADLINE_MS },
    );
    expect(document.activeElement).toBe(heading);
    expect(document.querySelector('video')).toBeNull();
  },
  RECOVERY_TEST_TIMEOUT_MS,
);

test(
  'pausing the film cancels automatic stall recovery',
  async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Open invitation' }));
    const video = document.querySelector('video')!;
    fireEvent.playing(video);
    fireEvent.pause(video);
    fireEvent.waiting(video);
    await new Promise((resolve) => window.setTimeout(resolve, PLAYBACK_RECOVERY_DEADLINE_MS));
    expect(document.querySelector('video')).not.toBeNull();
    expect(screen.queryByRole('heading', { name: 'Massimo & Elizaveta' })).toBeNull();
    fireEvent.ended(video);
    expect(screen.getByRole('heading', { name: 'Massimo & Elizaveta' })).toBeDefined();
  },
  RECOVERY_TEST_TIMEOUT_MS,
);

test('rejection of both audible and muted playback still opens the invitation', async () => {
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = () => Promise.reject(new Error('Playback was denied.'));
  try {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Open invitation' }));
    const heading = await screen.findByRole('heading', { name: 'Massimo & Elizaveta' });
    expect(document.activeElement).toBe(heading);
    expect(document.querySelector('video')).toBeNull();
  } finally {
    HTMLMediaElement.prototype.play = play;
  }
});

test('reduced motion opens immediately without playing the film', async () => {
  const original = window.matchMedia;
  window.matchMedia = (query) => {
    const media = original.call(window, query);
    Object.defineProperty(media, 'matches', { value: true });
    return media;
  };
  try {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Open invitation' }));
    expect(screen.queryByRole('button', { name: 'View invitation' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Massimo & Elizaveta' })).toBeDefined();
    expect(document.querySelector('video')).toBeNull();
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
