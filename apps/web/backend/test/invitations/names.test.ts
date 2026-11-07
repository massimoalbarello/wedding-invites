import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSqliteDatabase } from '#backend/db/client.ts';
import { runMigrations } from '#backend/db/migrate.ts';
import { getMigrations } from '#backend/lib/assets.ts';
import { OWNER_USER_ID } from '#backend/lib/auth/owner-registration.ts';
import { MAX_GUEST_NAME_LENGTH } from '#backend/models/invitations/model.ts';
import { InvitationsRepository } from '#backend/repositories/invitations/repository.ts';
import { cookies, fixture } from './fixture.ts';

const SUCCESS = 200;
const BAD_REQUEST = 400;
const actor = { userId: OWNER_USER_ID };

test('separate names survive creation and editing while full-name entry, search and replies stay intact', async () => {
  const f = await fixture();
  try {
    const owner = await f.admin();
    const created = await f.request({
      path: '/api/admin/guests',
      method: 'POST',
      cookie: owner,
      body: { firstName: ' Mary Jane ', lastName: ' van der Berg ', maxGuests: 1 },
    });
    expect(created.status).toBe(SUCCESS);
    const guest = await created.json();
    expect(guest).toMatchObject({
      firstName: 'Mary Jane',
      lastName: 'van der Berg',
      name: 'Mary Jane van der Berg',
    });
    const prefix = `/api/invitations/${guest.token}`;
    expect(await (await f.request({ path: prefix })).json()).toMatchObject({
      name: 'Mary Jane van der Berg',
    });
    const session = cookies(await f.request({ path: `${prefix}/session`, method: 'POST' }));
    const content = await (await f.request({ path: `${prefix}/content`, cookie: session })).json();
    expect(content).toMatchObject({ name: 'Mary Jane van der Berg', firstName: 'Mary Jane' });
    for (const search of ['van der Berg', 'Jane van']) {
      const found = await f.management.list({ actor, search });
      expect(found.items.map((item) => item.id)).toEqual([guest.id]);
    }
    const saved = await f.request({
      path: `${prefix}/rsvp`,
      method: 'PUT',
      cookie: session,
      body: { status: 'accepted', companions: ['Alex'] },
    });
    expect(saved.status).toBe(SUCCESS);
    const edited = await f.request({
      path: `/api/admin/guests/${guest.id}`,
      method: 'PATCH',
      cookie: owner,
      body: { firstName: 'Mary Jane', lastName: 'Berg', maxGuests: 1 },
    });
    expect(edited.status).toBe(SUCCESS);
    expect(await edited.json()).toMatchObject({
      firstName: 'Mary Jane',
      lastName: 'Berg',
      name: 'Mary Jane Berg',
      token: guest.token,
      status: 'accepted',
      companions: [{ name: 'Alex' }],
    });
    expect(
      await (await f.request({ path: `${prefix}/content`, cookie: session })).json(),
    ).toMatchObject({ firstName: 'Mary Jane', name: 'Mary Jane Berg', status: 'accepted' });
    expect((await f.management.list({ actor, search: 'van der' })).items).toEqual([]);
  } finally {
    await f.close();
  }
});

test('names reject blank first names and oversized surnames but allow one-name guests and legacy callers', async () => {
  const f = await fixture();
  try {
    const owner = await f.admin();
    for (const body of [
      { firstName: ' ' },
      { firstName: 'Alex', lastName: 'x'.repeat(MAX_GUEST_NAME_LENGTH + 1) },
    ]) {
      expect(
        (await f.request({ path: '/api/admin/guests', method: 'POST', cookie: owner, body }))
          .status,
      ).toBe(BAD_REQUEST);
    }
    for (const body of [{ firstName: 'Alex' }, { name: 'Alex Morgan' }]) {
      const result = await f.request({
        path: '/api/admin/guests',
        method: 'POST',
        cookie: owner,
        body,
      });
      expect(result.status).toBe(SUCCESS);
      const guest = await result.json();
      expect(guest).toMatchObject({
        firstName: 'firstName' in body ? 'Alex' : 'Alex Morgan',
        lastName: '',
        name: 'firstName' in body ? 'Alex' : 'Alex Morgan',
      });
    }
  } finally {
    await f.close();
  }
});

test('the name migration retains existing values and relationships for manual separation', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'guest-names-migration-'));
  const database = await createSqliteDatabase({ dataFolder: folder });
  try {
    await runMigrations({
      db: database,
      migrations: new Map([...getMigrations()].filter(([name]) => name < '0008_guest_names.sql')),
    });
    const now = new Date().toISOString();
    await database`insert into auth_user (id, name, email, emailVerified, createdAt, updatedAt)
      values ('owner', 'Owner', 'owner@test.invalid', 1, ${now}, ${now})`;
    await database`insert into invitation_guest (id, public_id, owner_id, token, name, status, max_guests, created_at)
      values ('guest', 'public', 'owner', 'link', 'Mary Jane van der Berg', 'accepted', 1, ${now})`;
    await database`insert into invitation_companion (id, owner_id, guest_id, name)
      values ('companion', 'owner', 'guest', 'Alex')`;
    await database`insert into invitation_session (token_hash, owner_id, guest_id, expires_at)
      values ('session', 'owner', 'guest', '2030-01-01T00:00:00.000Z')`;
    await runMigrations({ db: database });
    await runMigrations({ db: database });
    const guests = new InvitationsRepository(database);
    const before = await guests.byToken('link');
    expect(before).toMatchObject({
      firstName: 'Mary Jane van der Berg',
      lastName: '',
      token: 'link',
      status: 'accepted',
      companions: [{ name: 'Alex' }],
    });
    expect(
      await guests.update({
        ownerId: 'owner',
        guestId: 'guest',
        settings: { firstName: 'Mary Jane', lastName: 'van der Berg', groupName: '', maxGuests: 1 },
        references: [],
        removedPhotoIds: [],
      }),
    ).toBe('saved');
    expect(await guests.byToken('link')).toMatchObject({
      ...before,
      firstName: 'Mary Jane',
      lastName: 'van der Berg',
    });
    expect(
      await guests.hasSession({ ownerId: 'owner', guestId: 'guest', tokenHash: 'session', now }),
    ).toBe(true);
    await expect(
      Promise.resolve(database`update invitation_guest set first_name = ' '`),
    ).rejects.toThrow();
    await expect(
      Promise.resolve(
        database`update invitation_guest set last_name = ${'x'.repeat(MAX_GUEST_NAME_LENGTH + 1)}`,
      ),
    ).rejects.toThrow();
  } finally {
    await database.close();
    await rm(folder, { recursive: true, force: true });
  }
});
