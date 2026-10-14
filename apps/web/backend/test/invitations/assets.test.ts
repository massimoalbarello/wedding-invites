import { expect, test } from 'bun:test';
import { OWNER_USER_ID } from '#backend/lib/auth/owner-registration.ts';
import { cookies, fixture } from './fixture';

const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const CONFLICT = 409;
const PARTIAL_CONTENT = 206;
const RANGE_NOT_SATISFIABLE = 416;

test('the invitation and all its resources require the matching active guest session', async () => {
  const f = await fixture({
    assets: new Map([
      ['index.html', new Blob(['<h1>Private couple names</h1>'], { type: 'text/html' })],
      ['media/story.mp4', new Blob(['0123456789'], { type: 'video/mp4' })],
    ]),
  });
  try {
    const owner = await f.admin();
    const guest = await f.management.create({
      actor: { userId: OWNER_USER_ID },
      settings: { name: 'Alex', groupName: '', maxGuests: 1 },
    });
    const other = await f.management.create({
      actor: { userId: OWNER_USER_ID },
      settings: { name: 'Sam', groupName: '', maxGuests: 0 },
    });
    const base = `/api/invitations/${guest.token}`;
    expect(await (await f.request({ path: base })).json()).toEqual({
      name: 'Alex',
      authenticated: false,
      faceScanRequired: false,
    });
    for (const path of ['index.html', 'media/story.mp4', 'missing.js']) {
      expect((await f.request({ path: `${base}/assets/amalfi/${path}` })).status).toBe(
        UNAUTHORIZED,
      );
    }
    const session = cookies(await f.request({ path: `${base}/session`, method: 'POST' }));
    const content = await (await f.request({ path: `${base}/content`, cookie: session })).json();
    expect(content).toEqual({
      name: 'Alex',
      status: 'pending',
      maxGuests: 1,
      companions: [],
      assetUrl: `${base}/assets/amalfi/index.html`,
    });
    const html = await f.request({ path: content.assetUrl, cookie: session });
    expect(await html.text()).toContain('Private couple names');
    expect(html.headers.get('cache-control')).toBe('private, no-store');
    expect(
      (await f.request({ path: `${base}/assets/amalfi/missing.js`, cookie: session })).status,
    ).toBe(NOT_FOUND);
    expect(
      (
        await f.request({
          path: `/api/invitations/${other.token}/assets/amalfi/index.html`,
          cookie: session,
        })
      ).status,
    ).toBe(UNAUTHORIZED);
    const range = async (value: string) =>
      f.app.handle(
        new Request(`http://localhost:3000${base}/assets/amalfi/media/story.mp4`, {
          headers: { cookie: session, range: value },
        }),
      );
    const segment = await range('bytes=2-5');
    expect(segment.status).toBe(PARTIAL_CONTENT);
    expect(segment.headers.get('content-range')).toBe('bytes 2-5/10');
    expect(await segment.text()).toBe('2345');
    expect(await (await range('bytes=-3')).text()).toBe('789');
    expect((await range('bytes=50-60')).status).toBe(RANGE_NOT_SATISFIABLE);
    expect((await range('bytes=0-1,4-5')).status).toBe(RANGE_NOT_SATISFIABLE);
    await f.request({
      path: `/api/admin/guests/${guest.id}/sessions`,
      method: 'DELETE',
      cookie: owner,
    });
    expect((await f.request({ path: content.assetUrl, cookie: session })).status).toBe(
      UNAUTHORIZED,
    );
  } finally {
    await f.close();
  }
});

test('a missing package blocks content and RSVP without requiring wedding settings', async () => {
  const f = await fixture({ assets: new Map() });
  try {
    await f.admin();
    const guest = await f.management.create({
      actor: { userId: OWNER_USER_ID },
      settings: { name: 'Alex', groupName: '', maxGuests: 0 },
    });
    const base = `/api/invitations/${guest.token}`;
    const session = cookies(await f.request({ path: `${base}/session`, method: 'POST' }));
    expect((await f.request({ path: `${base}/content`, cookie: session })).status).toBe(CONFLICT);
    expect(
      (
        await f.request({
          path: `${base}/rsvp`,
          method: 'PUT',
          cookie: session,
          body: { status: 'accepted', companions: [] },
        })
      ).status,
    ).toBe(CONFLICT);
    expect(
      (await f.management.get({ actor: { userId: OWNER_USER_ID }, id: guest.id })).status,
    ).toBe('pending');
  } finally {
    await f.close();
  }
});
