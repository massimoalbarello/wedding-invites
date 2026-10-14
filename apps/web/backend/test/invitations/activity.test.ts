import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSqliteDatabase } from '#backend/db/client.ts';
import { runMigrations } from '#backend/db/migrate.ts';
import { getMigrations } from '#backend/lib/assets.ts';
import { OWNER_USER_ID } from '#backend/lib/auth/owner-registration.ts';
import { FaceAnalysisError } from '#backend/lib/faces/errors.ts';
import { cookies, fixture, observation, photo, upload } from './fixture.ts';

const actor = { userId: OWNER_USER_ID };
const settings = { name: 'Ada Lovelace', groupName: 'Friends', maxGuests: 0 };
const OK = 200;
const FORBIDDEN = 403;
const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const BAD_REQUEST = 400;
const UNAVAILABLE = 503;
const REFERENCE = 1;
const MISMATCH = 3;
const SELFIE = 4;
const emptyActivity = {
  linkOpenedAt: null,
  verificationFailedAt: null,
  verifiedAt: null,
  invitationOpenedAt: null,
};

test('owner-visible activity distinguishes entry, verification, invitation HTML, and RSVP', async () => {
  const f = await fixture();
  try {
    const owner = await f.admin();
    const guest = await f.management.create({ actor, settings, photos: [photo(REFERENCE)] });
    const route = `/api/invitations/${guest.token}`;
    const detail = async () => (await f.management.get({ actor, id: guest.id })).activity;
    expect(await detail()).toEqual(emptyActivity);
    expect((await f.request({ path: `${route}/content` })).status).toBe(UNAUTHORIZED);
    expect((await f.request({ path: `${route}/assets/amalfi/index.html` })).status).toBe(
      UNAUTHORIZED,
    );
    expect(await detail()).toEqual(emptyActivity);
    await f.request({ path: route });
    const entered = await detail();
    expect(entered.linkOpenedAt).toEqual(expect.any(String));
    await f.request({ path: route });
    expect(await detail()).toEqual(entered);
    for (const attempt of [MISMATCH, REFERENCE]) {
      expect(
        (await f.request({ path: `${route}/verify`, method: 'POST', body: upload(attempt) }))
          .status,
      ).toBe(FORBIDDEN);
      expect(await detail()).toMatchObject({
        verificationFailedAt: expect.any(String),
        verifiedAt: null,
      });
    }
    const invalid = new FormData();
    invalid.set('photo', new File(['invalid'], 'photo.jpg'));
    expect(
      (await f.request({ path: `${route}/verify`, method: 'POST', body: invalid })).status,
    ).toBe(BAD_REQUEST);
    const failed = await detail();
    const login = await f.request({
      path: `${route}/verify`,
      method: 'POST',
      body: upload(SELFIE),
    });
    expect(login.status).toBe(OK);
    const session = cookies(login);
    expect(await detail()).toMatchObject({ ...failed, verifiedAt: expect.any(String) });
    expect((await f.request({ path: `${route}/content`, cookie: session })).status).toBe(OK);
    expect((await detail()).invitationOpenedAt).toBeNull();
    expect(
      (await f.request({ path: `${route}/assets/amalfi/missing.html`, cookie: session })).status,
    ).toBe(NOT_FOUND);
    expect((await detail()).invitationOpenedAt).toBeNull();
    expect(
      (await f.request({ path: `${route}/assets/amalfi/index.html`, cookie: session })).status,
    ).toBe(OK);
    const opened = await detail();
    expect(opened.invitationOpenedAt).toEqual(expect.any(String));
    await f.request({ path: `${route}/assets/amalfi/index.html`, cookie: session });
    expect(await detail()).toEqual(opened);
    expect(
      (
        await f.request({
          path: `${route}/rsvp`,
          method: 'PUT',
          cookie: session,
          body: { status: 'accepted', companions: [] },
        })
      ).status,
    ).toBe(OK);
    const list = await (await f.request({ path: '/api/admin/guests', cookie: owner })).json();
    expect(list.items[0]).toMatchObject({ status: 'accepted', activity: opened });
    await f.management.rotate({ actor, id: guest.id });
    expect((await f.request({ path: route })).status).toBe(NOT_FOUND);
    expect(await detail()).toEqual(opened);
  } finally {
    await f.close();
  }
});

test('guests without a selfie step can open an invitation without a false verification success', async () => {
  const f = await fixture();
  try {
    await f.admin();
    const guest = await f.management.create({ actor, settings });
    const route = `/api/invitations/${guest.token}`;
    await f.request({ path: route });
    const session = cookies(await f.request({ path: `${route}/session`, method: 'POST' }));
    expect(
      (await f.request({ path: `${route}/assets/amalfi/index.html`, cookie: session })).status,
    ).toBe(OK);
    expect((await f.management.get({ actor, id: guest.id })).activity).toEqual({
      ...emptyActivity,
      linkOpenedAt: expect.any(String),
      invitationOpenedAt: expect.any(String),
    });
  } finally {
    await f.close();
  }
});

test('face service outages do not classify the guest as failing verification', async () => {
  const f = await fixture({
    faces: {
      analyze: () =>
        Promise.reject(new FaceAnalysisError({ code: 'unavailable', message: 'Try again later.' })),
    },
  });
  try {
    await f.admin();
    const guest = await f.management.create({ actor, settings });
    await f.guests.addReference({
      ownerId: actor.userId,
      guestId: (await f.management.find({ actor, id: guest.id })).id,
      id: 'reference',
      image: new Uint8Array([1]),
      mediaType: 'image/jpeg',
      observation: observation(REFERENCE),
      createdAt: new Date().toISOString(),
    });
    expect(
      (
        await f.request({
          path: `/api/invitations/${guest.token}/verify`,
          method: 'POST',
          body: upload(SELFIE),
        })
      ).status,
    ).toBe(UNAVAILABLE);
    expect((await f.management.get({ actor, id: guest.id })).activity).toEqual(emptyActivity);
  } finally {
    await f.close();
  }
});

test('activity writes require the owner, active current link, and a live session for invitation opens', async () => {
  const f = await fixture();
  try {
    await f.admin();
    const publicGuest = await f.management.create({ actor, settings });
    const guest = await f.management.find({ actor, id: publicGuest.id });
    const input = {
      ownerId: guest.ownerId,
      guestId: guest.id,
      linkToken: guest.token,
      event: 'link_opened' as const,
      now: new Date().toISOString(),
    };
    expect(await f.guests.recordActivity({ ...input, ownerId: 'outsider' })).toBe(false);
    expect(await f.guests.recordActivity({ ...input, linkToken: 'old-link' })).toBe(false);
    expect(await f.guests.recordActivity({ ...input, event: 'invitation_opened' })).toBe(false);
    await f.management.setAccess({ actor, id: guest.publicId, active: false });
    expect(await f.guests.recordActivity(input)).toBe(false);
    expect((await f.management.get({ actor, id: guest.publicId })).activity).toEqual(emptyActivity);
  } finally {
    await f.close();
  }
});

test('the activity migration preserves pre-existing guests and replies without inventing history', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'invitation-activity-migration-'));
  const database = await createSqliteDatabase({ dataFolder: folder });
  try {
    const migrations = getMigrations();
    await runMigrations({
      db: database,
      migrations: new Map(
        [...migrations].filter(([name]) => name !== '0006_invitation_activity.sql'),
      ),
    });
    const now = new Date().toISOString();
    await database`insert into auth_user (id, name, email, emailVerified, createdAt, updatedAt) values ('owner', 'Owner', 'owner@test.invalid', 1, ${now}, ${now})`;
    await database`insert into invitation_guest (id, public_id, owner_id, token, name, status, created_at) values ('guest', 'public', 'owner', 'link', 'Existing guest', 'accepted', ${now})`;
    await database`insert into invitation_companion (id, owner_id, guest_id, name) values ('companion', 'owner', 'guest', 'Existing companion')`;
    await runMigrations({ db: database });
    await runMigrations({ db: database });
    const rows =
      await database`select name, status, link_opened_at, verification_failed_at, verified_at, invitation_opened_at from invitation_guest`;
    expect(rows).toEqual([
      {
        name: 'Existing guest',
        status: 'accepted',
        link_opened_at: null,
        verification_failed_at: null,
        verified_at: null,
        invitation_opened_at: null,
      },
    ]);
    expect(await database<{ name: string }[]>`select name from invitation_companion`).toEqual([
      { name: 'Existing companion' },
    ]);
  } finally {
    await database.close();
    await rm(folder, { recursive: true, force: true });
  }
});
