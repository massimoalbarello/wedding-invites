import { expect, test } from 'bun:test';
import { treaty } from '@elysiajs/eden';
import { OWNER_USER_ID } from '#backend/lib/auth/owner-registration.ts';
import type { GuestListInput } from '#backend/models/invitations/model.ts';
import { cookies, fixture } from './fixture.ts';

const SUCCESS = 200;
const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const PAGE_SIZE = 2;
const actor = { userId: OWNER_USER_ID };
const defaults = { name: 'Guest', groupName: '', faceScanRequired: false, maxGuests: 1 };

test('group pagination keeps exact groups together across boundaries and ungrouped guests last', async () => {
  const f = await fixture();
  try {
    const owner = await f.admin();
    const api = treaty(f.app, { parseDate: false });
    const options = { headers: { cookie: owner } };
    const created: Awaited<ReturnType<typeof f.management.create>>[] = [];
    for (const [index, groupName] of [
      '',
      'Friends',
      'Family',
      'friends',
      'Family',
      'Alpha',
      'Family',
      'zeta',
      '',
    ].entries()) {
      created.push(
        await f.management.create({
          actor,
          settings: { ...defaults, name: `Guest ${index}`, groupName },
        }),
      );
    }
    const expectedGroups = ['Alpha', 'Family', 'Friends', 'friends', 'zeta', ''];
    const expectedIds = expectedGroups.flatMap((group) =>
      created
        .filter((guest) => guest.groupName === group)
        .map((guest) => guest.id)
        .sort(),
    );
    let cursor: string | undefined;
    const foundIds: string[] = [];
    const foundGroups: string[] = [];
    do {
      const result = await api.api.admin.guests.get({
        ...options,
        query: { order: 'group', limit: PAGE_SIZE, cursor },
      });
      expect(result.status).toBe(SUCCESS);
      expect(result.data!.items.length).toBeLessThanOrEqual(PAGE_SIZE);
      foundIds.push(...result.data!.items.map((guest) => guest.id));
      foundGroups.push(...result.data!.items.map((guest) => guest.groupName));
      cursor = result.data!.nextCursor ?? undefined;
    } while (cursor && foundIds.length <= created.length);
    expect(cursor).toBeUndefined();
    expect(foundIds).toEqual(expectedIds);
    expect(new Set(foundIds).size).toBe(created.length);
    expect(foundGroups).toEqual([
      'Alpha',
      'Family',
      'Family',
      'Family',
      'Friends',
      'friends',
      'zeta',
      '',
      '',
    ]);
    expect((await api.api.admin.groups.get(options)).data).toEqual(expectedGroups.slice(0, -1));
    const originalOrder = await api.api.admin.guests.get(options);
    expect(originalOrder.data!.items.map((guest) => guest.id)).toEqual(
      created.map((guest) => guest.id).sort(),
    );
    const last = foundIds.at(-1)!;
    expect(
      (await api.api.admin.guests.get({ ...options, query: { order: 'group', cursor: last } }))
        .data,
    ).toEqual({ items: [], nextCursor: null });
  } finally {
    await f.close();
  }
});

test('group ordering composes with exact groups, explicit ungrouped, replies and companion searches', async () => {
  const f = await fixture();
  try {
    const owner = await f.admin();
    const api = treaty(f.app, { parseDate: false });
    const family = await f.management.create({
      actor,
      settings: { ...defaults, name: 'Ada', groupName: 'Family' },
    });
    const sameFamily = await f.management.create({
      actor,
      settings: { ...defaults, name: 'Grace', groupName: 'Family' },
    });
    const differentCase = await f.management.create({
      actor,
      settings: { ...defaults, name: 'Charles', groupName: 'family' },
    });
    const ungrouped = await f.management.create({ actor, settings: { ...defaults, name: 'Alan' } });
    const route = `/api/invitations/${family.token}`;
    const session = cookies(await f.request({ path: `${route}/session`, method: 'POST' }));
    expect(
      (
        await f.request({
          path: `${route}/rsvp`,
          method: 'PUT',
          cookie: session,
          body: { status: 'accepted', companions: ['Katherine Johnson'] },
        })
      ).status,
    ).toBe(SUCCESS);
    const list = async (query: Partial<GuestListInput>) => {
      const result = await api.api.admin.guests.get({
        headers: { cookie: owner },
        query: { ...query, order: 'group' },
      });
      expect(result.status).toBe(SUCCESS);
      return result.data!.items.map((guest) => guest.id);
    };
    expect(await list({ group: 'Family' })).toEqual([family.id, sameFamily.id].sort());
    expect(await list({ group: 'family' })).toEqual([differentCase.id]);
    expect(await list({ group: '' })).toEqual([ungrouped.id]);
    expect(await list({ group: '', search: 'Alan', status: 'pending' })).toEqual([ungrouped.id]);
    expect(await list({ search: 'katherine', status: 'accepted', group: 'Family' })).toEqual([
      family.id,
    ]);
    expect(await list({ search: 'katherine', status: 'pending' })).toEqual([]);
    expect(await list({ search: 'FAMILY', status: 'pending' })).toEqual([
      sameFamily.id,
      differentCase.id,
    ]);
    expect(await list({ group: 'Family', cursor: family.id, limit: 1 })).toEqual([sameFamily.id]);
    expect(
      (await f.request({ path: '/api/admin/guests?order=invalid', cookie: owner })).status,
    ).toBe(BAD_REQUEST);
  } finally {
    await f.close();
  }
});

test('group cursors are resolved only inside the acting owner scope', async () => {
  const f = await fixture();
  try {
    const owner = await f.admin();
    await f.admin('outsider');
    const guest = await f.management.create({
      actor,
      settings: { ...defaults, groupName: 'Family' },
    });
    const foreign = await f.management.create({
      actor,
      settings: { ...defaults, groupName: 'Alpha' },
    });
    // Preserve a real persisted foreign row to distinguish missing cursors from unscoped lookups.
    await f.database`update invitation_guest set owner_id = 'outsider' where public_id = ${foreign.id}`;
    const api = treaty(f.app, { parseDate: false });
    const query = { order: 'group' as const, cursor: foreign.id };
    expect((await api.api.admin.guests.get({ query })).status).toBe(UNAUTHORIZED);
    const hidden = await api.api.admin.guests.get({ headers: { cookie: owner }, query });
    expect(hidden.status).toBe(SUCCESS);
    expect(hidden.data).toEqual({ items: [], nextCursor: null });
    const missing = await api.api.admin.guests.get({
      headers: { cookie: owner },
      query: { ...query, cursor: crypto.randomUUID() },
    });
    expect(missing.data).toEqual(hidden.data);
    const first = await api.api.admin.guests.get({
      headers: { cookie: owner },
      query: { order: 'group' },
    });
    expect(first.data!.items.map((item) => item.id)).toEqual([guest.id]);
    expect((await api.api.admin.groups.get({ headers: { cookie: owner } })).data).toEqual([
      'Family',
    ]);
  } finally {
    await f.close();
  }
});
