import { expect, test } from 'bun:test';
import { OWNER_USER_ID } from '#backend/lib/auth/owner-registration.ts';
import { InvitationsRepository } from '#backend/repositories/invitations/repository.ts';
import { cookies, fixture, upload } from './fixture.ts';

const SUCCESS = 200;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const BAD_REQUEST = 400;
const CONFLICT = 409;
const REFERENCE = 1;
const ALTERNATE_REFERENCE = 2;
const MISMATCH = 3;
const SELFIE = 4;
const actor = { userId: OWNER_USER_ID };
const defaults = {
  name: 'Ada Lovelace',
  groupName: 'Friends',
  faceScanRequired: false,
  maxGuests: 1,
};

test('owner auth, CSRF, private assets, and personal link sessions enforce separate trust boundaries', async () => {
  const f = await fixture();
  try {
    expect(await (await f.request({ path: '/api/admin/status' })).json()).toEqual({
      hasOwner: false,
    });
    const owner = await f.admin();
    const outsider = await f.admin('outsider');
    expect((await f.request({ path: '/api/admin/guests' })).status).toBe(UNAUTHORIZED);
    expect((await f.request({ path: '/api/admin/guests', cookie: outsider })).status).toBe(
      UNAUTHORIZED,
    );
    expect(
      (
        await f.request({
          path: '/api/admin/guests',
          cookie: owner,
          method: 'POST',
          origin: 'https://elsewhere.invalid',
          body: defaults,
        })
      ).status,
    ).toBe(FORBIDDEN);
    const create = await f.request({
      path: '/api/admin/guests',
      cookie: owner,
      method: 'POST',
      body: defaults,
    });
    expect(create.status).toBe(SUCCESS);
    const guest = await create.json();
    const route = `/api/invitations/${guest.token}`;
    const entry = await f.request({ path: route });
    expect(await entry.json()).toEqual({
      name: defaults.name,
      faceScanRequired: false,
      authenticated: false,
    });
    expect(entry.headers.get('cache-control')).toBe('private, no-store');
    expect((await f.request({ path: `${route}/content` })).status).toBe(UNAUTHORIZED);
    expect(
      (
        await f.request({
          path: `${route}/session`,
          method: 'POST',
          origin: 'https://elsewhere.invalid',
        })
      ).status,
    ).toBe(FORBIDDEN);
    const login = await f.request({ path: `${route}/session`, method: 'POST' });
    expect(login.status).toBe(SUCCESS);
    expect(login.headers.get('set-cookie')).toContain('HttpOnly');
    const session = cookies(login);
    expect((await f.request({ path: `${route}/content`, cookie: session })).status).toBe(SUCCESS);
    expect((await f.request({ path: `${route}/content` })).status).toBe(UNAUTHORIZED);
    const another = await f.management.create({ actor, settings: { ...defaults, name: 'Grace' } });
    expect(
      (await f.request({ path: `/api/invitations/${another.token}/content`, cookie: session }))
        .status,
    ).toBe(UNAUTHORIZED);
    await f.request({
      path: `/api/admin/guests/${guest.id}/photos`,
      method: 'POST',
      cookie: owner,
      body: upload(REFERENCE),
    });
    const detail = await f.management.get({ actor, id: guest.id });
    const imagePath = `/api/admin/guests/${guest.id}/photos/${detail.references[0]!.id}`;
    expect((await f.request({ path: imagePath })).status).toBe(UNAUTHORIZED);
    expect((await f.request({ path: imagePath, cookie: session })).status).toBe(UNAUTHORIZED);
    const image = await f.request({ path: imagePath, cookie: owner });
    expect(image.status).toBe(SUCCESS);
    expect(image.headers.get('cache-control')).toBe('private, no-store');
    expect(await f.guests.get({ ownerId: 'outsider', publicId: guest.id })).toBeNull();
    expect(
      (await f.request({ path: '/api/auth/passkey/generate-register-options?name=Intruder' }))
        .status,
    ).toBe(FORBIDDEN);
  } finally {
    await f.close();
  }
});

test('only this guest references match and any reused reference rejects before another match grants access', async () => {
  const f = await fixture();
  try {
    const owner = await f.admin();
    const guest = await f.management.create({
      actor,
      settings: { ...defaults, faceScanRequired: true },
    });
    const route = `/api/invitations/${guest.token}`;
    expect((await f.request({ path: `${route}/session`, method: 'POST' })).status).toBe(FORBIDDEN);
    expect(
      (await f.request({ path: `${route}/verify`, method: 'POST', body: upload(SELFIE) })).status,
    ).toBe(CONFLICT);
    for (const reference of [REFERENCE, ALTERNATE_REFERENCE]) {
      const response = await f.request({
        path: `/api/admin/guests/${guest.id}/photos`,
        method: 'POST',
        cookie: owner,
        body: upload(reference),
      });
      expect(response.status).toBe(SUCCESS);
    }
    expect(
      (await f.request({ path: `${route}/verify`, method: 'POST', body: upload(MISMATCH) })).status,
    ).toBe(FORBIDDEN);
    const duplicate = await f.request({
      path: `${route}/verify`,
      method: 'POST',
      body: upload(ALTERNATE_REFERENCE),
    });
    expect(duplicate.status).toBe(FORBIDDEN);
    expect((await duplicate.json()).error).toContain('reference photo');
    expect(duplicate.headers.get('set-cookie')).toBeNull();
    const login = await f.request({
      path: `${route}/verify`,
      method: 'POST',
      body: upload(SELFIE),
    });
    expect(login.status).toBe(SUCCESS);
    expect((await f.request({ path: `${route}/content`, cookie: cookies(login) })).status).toBe(
      SUCCESS,
    );
  } finally {
    await f.close();
  }
});

test('revocation, access-mode changes, expiration and link rotation invalidate existing guest access', async () => {
  const f = await fixture();
  try {
    await f.admin();
    const guest = await f.management.create({ actor, settings: defaults });
    const route = `/api/invitations/${guest.token}`;
    const login = () => f.request({ path: `${route}/session`, method: 'POST' });
    let session = cookies(await login());
    await f.management.revokeSessions({ actor, id: guest.id });
    expect((await f.request({ path: `${route}/content`, cookie: session })).status).toBe(
      UNAUTHORIZED,
    );
    session = cookies(await login());
    await f.database`update invitation_session set expires_at = '2000-01-01T00:00:00.000Z'`;
    expect((await f.request({ path: `${route}/content`, cookie: session })).status).toBe(
      UNAUTHORIZED,
    );
    session = cookies(await login());
    await f.management.update({
      actor,
      id: guest.id,
      settings: { ...defaults, faceScanRequired: true },
    });
    expect((await f.request({ path: `${route}/content`, cookie: session })).status).toBe(
      UNAUTHORIZED,
    );
    await f.management.update({ actor, id: guest.id, settings: defaults });
    session = cookies(await login());
    await f.management.setAccess({ actor, id: guest.id, active: false });
    expect((await f.request({ path: `${route}/content`, cookie: session })).status).toBe(NOT_FOUND);
    expect((await login()).status).toBe(NOT_FOUND);
    await f.management.setAccess({ actor, id: guest.id, active: true });
    expect((await f.request({ path: `${route}/content`, cookie: session })).status).toBe(
      UNAUTHORIZED,
    );
    session = cookies(await login());
    const rotated = await f.management.rotate({ actor, id: guest.id });
    expect((await f.request({ path: route })).status).toBe(NOT_FOUND);
    expect(
      (await f.request({ path: `/api/invitations/${rotated.token}/content`, cookie: session }))
        .status,
    ).toBe(UNAUTHORIZED);
  } finally {
    await f.close();
  }
});

test('RSVP capacity, companion names, counts and cursor pages stay consistent', async () => {
  const f = await fixture();
  try {
    const owner = await f.admin();
    const guest = await f.management.create({ actor, settings: defaults });
    await f.management.create({
      actor,
      settings: { ...defaults, name: 'Second guest', groupName: 'Family' },
    });
    const route = `/api/invitations/${guest.token}`;
    const session = cookies(await f.request({ path: `${route}/session`, method: 'POST' }));
    const respond = (body: unknown) =>
      f.request({ path: `${route}/rsvp`, method: 'PUT', cookie: session, body });
    expect((await respond({ status: 'accepted', companions: ['One', 'Two'] })).status).toBe(
      BAD_REQUEST,
    );
    expect((await f.management.stats({ actor })).pending).toBe(2);
    expect((await respond({ status: 'accepted', companions: ['  Charles  '] })).status).toBe(
      SUCCESS,
    );
    expect(await f.management.stats({ actor })).toEqual({
      invited: 2,
      accepted: 1,
      declined: 0,
      pending: 1,
      companions: 1,
      attending: 2,
    });
    const first = await f.management.list({ actor, limit: 1 });
    const second = await f.management.list({ actor, limit: 1, cursor: first.nextCursor! });
    expect(first.items[0]!.id).not.toBe(second.items[0]!.id);
    expect(second.nextCursor).toBeNull();
    const matches = await f.management.list({ actor, search: 'charles' });
    expect(matches.items[0]!.companions[0]!.name).toBe('Charles');
    expect((await f.management.list({ actor, group: 'Family' })).items).toHaveLength(1);
    const reduce = await f.request({
      path: `/api/admin/guests/${guest.id}`,
      method: 'PATCH',
      cookie: owner,
      body: { ...defaults, maxGuests: 0, faceScanRequired: true },
    });
    expect(reduce.status).toBe(CONFLICT);
    expect((await f.management.get({ actor, id: guest.id })).maxGuests).toBe(1);
    expect((await f.request({ path: `${route}/content`, cookie: session })).status).toBe(SUCCESS);
    expect((await respond({ status: 'declined', companions: [] })).status).toBe(SUCCESS);
    expect(await f.management.stats({ actor })).toEqual({
      invited: 2,
      accepted: 0,
      declined: 1,
      pending: 1,
      companions: 0,
      attending: 0,
    });
    expect((await f.management.get({ actor, id: guest.id })).companions).toEqual([]);
  } finally {
    await f.close();
  }
});

test.each(['revoke', 'rotate'])(
  '%s racing an RSVP commit leaves the response and companion state unchanged',
  async (action) => {
    const entered = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    class PausedRsvpRepository extends InvitationsRepository {
      override async rsvp(input: Parameters<InvitationsRepository['rsvp']>[0]) {
        entered.resolve();
        await resume.promise;
        return super.rsvp(input);
      }
    }
    const f = await fixture({
      createInvitationsRepository: (database) => new PausedRsvpRepository(database),
    });
    try {
      await f.admin();
      const guest = await f.management.create({ actor, settings: defaults });
      const route = `/api/invitations/${guest.token}`;
      const session = cookies(await f.request({ path: `${route}/session`, method: 'POST' }));
      const response = f.request({
        path: `${route}/rsvp`,
        method: 'PUT',
        cookie: session,
        body: { status: 'accepted', companions: ['A companion'] },
      });
      await entered.promise;
      if (action === 'revoke') {
        await f.management.revokeSessions({ actor, id: guest.id });
      } else {
        await f.management.rotate({ actor, id: guest.id });
      }
      resume.resolve();
      expect((await response).status).toBe(action === 'revoke' ? UNAUTHORIZED : NOT_FOUND);
      expect(await f.management.get({ actor, id: guest.id })).toMatchObject({
        status: 'pending',
        companions: [],
      });
      expect(await f.management.stats({ actor })).toMatchObject({
        pending: 1,
        accepted: 0,
        companions: 0,
        attending: 0,
      });
    } finally {
      resume.resolve();
      await f.close();
    }
  },
);
