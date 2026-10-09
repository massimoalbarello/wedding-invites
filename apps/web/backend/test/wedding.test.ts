import { expect, test } from 'bun:test';
import { createSqliteDatabase } from '#backend/db/client.ts';
import { OWNER_USER_ID } from '#backend/lib/auth/owner-registration.ts';
import { MAX_COUPLE_NAMES_LENGTH } from '#backend/models/wedding/model.ts';
import { WeddingRepository } from '#backend/repositories/wedding/repository.ts';
import { cookies, fixture } from './invitations/fixture.ts';

const OK = 200;
const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const CONFLICT = 409;
const actor = { userId: OWNER_USER_ID };
const wedding = { coupleNames: 'Alex & Sam', date: '2032-02-29' };

test('wedding settings are owner-only, origin-protected, and persist as one owner-scoped record', async () => {
  const f = await fixture({ weddingConfigured: false });
  try {
    const owner = await f.admin();
    const outsider = await f.admin('outsider');
    expect((await f.request({ path: '/api/admin/wedding' })).status).toBe(UNAUTHORIZED);
    expect(
      (await f.request({ path: '/api/admin/wedding', method: 'PUT', body: wedding })).status,
    ).toBe(UNAUTHORIZED);
    expect((await f.request({ path: '/api/admin/wedding', cookie: outsider })).status).toBe(
      UNAUTHORIZED,
    );
    expect(
      await (await f.request({ path: '/api/admin/wedding', cookie: owner })).json(),
    ).toBeNull();
    const forged = await f.request({
      path: '/api/admin/wedding',
      cookie: owner,
      method: 'PUT',
      origin: 'https://untrusted.invalid',
      body: wedding,
    });
    expect(forged.status).toBe(FORBIDDEN);
    const saved = await f.request({
      path: '/api/admin/wedding',
      cookie: owner,
      method: 'PUT',
      body: { ...wedding, coupleNames: `  ${wedding.coupleNames}  ` },
    });
    expect(saved.status).toBe(OK);
    expect(await saved.json()).toEqual(wedding);
    expect(saved.headers.get('cache-control')).toBe('private, no-store');
    const changed = { coupleNames: 'Riley & Quinn', date: '2033-05-20' };
    expect(
      (await f.request({ path: '/api/admin/wedding', cookie: owner, method: 'PUT', body: changed }))
        .status,
    ).toBe(OK);
    const reopened = await createSqliteDatabase({ dataFolder: f.folder });
    try {
      const settings = new WeddingRepository(reopened);
      expect(await settings.get({ ownerId: OWNER_USER_ID })).toEqual(changed);
      expect(await settings.get({ ownerId: 'outsider' })).toBeNull();
      const rows = (await reopened`select owner_id from wedding_settings`) as {
        owner_id: string;
      }[];
      expect(rows).toEqual([{ owner_id: OWNER_USER_ID }]);
    } finally {
      await reopened.close();
    }
    expect(() => f.wedding.get({ actor: { userId: 'outsider' } })).toThrow('Forbidden');
  } finally {
    await f.close();
  }
});

test('invalid calendar dates and blank or excessive couple names cannot change saved settings', async () => {
  const f = await fixture({ weddingConfigured: false });
  try {
    const owner = await f.admin();
    await f.wedding.save({ actor, settings: wedding });
    const invalid = [
      { ...wedding, date: '2031-02-29' },
      { ...wedding, date: '2032-02-30' },
      { ...wedding, date: '2031-04-31' },
      { ...wedding, date: '2031-13-01' },
      { ...wedding, date: '2031-00-01' },
      { ...wedding, date: '2031-01-00' },
      { ...wedding, date: '2031-1-01' },
      { ...wedding, date: '2031-01-01T12:00:00Z' },
      { ...wedding, coupleNames: '' },
      { ...wedding, coupleNames: '   ' },
      { ...wedding, coupleNames: 'a'.repeat(MAX_COUPLE_NAMES_LENGTH + 1) },
    ];
    for (const body of invalid) {
      expect(
        (await f.request({ path: '/api/admin/wedding', cookie: owner, method: 'PUT', body }))
          .status,
      ).toBe(BAD_REQUEST);
      expect(await f.wedding.get({ actor })).toEqual(wedding);
    }
  } finally {
    await f.close();
  }
});

test('guest entry stays anonymous and configured wedding details are available only after guest authorization', async () => {
  const f = await fixture({ weddingConfigured: false });
  try {
    const owner = await f.admin();
    const guest = await f.management.create({
      actor,
      settings: { name: 'Jamie', groupName: '', faceScanRequired: false, maxGuests: 0 },
    });
    const path = `/api/invitations/${guest.token}`;
    expect(await (await f.request({ path })).json()).toEqual({
      name: 'Jamie',
      faceScanRequired: false,
      authenticated: false,
    });
    expect((await f.request({ path: `${path}/content` })).status).toBe(UNAUTHORIZED);
    const session = cookies(await f.request({ path: `${path}/session`, method: 'POST' }));
    const unavailable = await f.request({ path: `${path}/content`, cookie: session });
    expect(unavailable.status).toBe(CONFLICT);
    expect(await unavailable.json()).toEqual({
      error: 'This invitation is not ready yet. Please try again later.',
    });
    const reply = await f.request({
      path: `${path}/rsvp`,
      method: 'PUT',
      cookie: session,
      body: { status: 'accepted', companions: [] },
    });
    expect(reply.status).toBe(CONFLICT);
    expect((await f.management.get({ actor, id: guest.id })).status).toBe('pending');
    expect(
      (await f.request({ path: '/api/admin/wedding', cookie: owner, method: 'PUT', body: wedding }))
        .status,
    ).toBe(OK);
    expect(await (await f.request({ path, cookie: session })).json()).toEqual({
      name: 'Jamie',
      faceScanRequired: false,
      authenticated: true,
    });
    const content = await f.request({ path: `${path}/content`, cookie: session });
    expect(content.status).toBe(OK);
    expect(await content.json()).toMatchObject({ ...wedding, name: 'Jamie' });
    expect((await f.request({ path: `${path}/content` })).status).toBe(UNAUTHORIZED);
    const updated = { coupleNames: 'Morgan & Taylor', date: '2034-10-07' };
    await f.wedding.save({ actor, settings: updated });
    expect(
      await (await f.request({ path: `${path}/content`, cookie: session })).json(),
    ).toMatchObject(updated);
  } finally {
    await f.close();
  }
});
