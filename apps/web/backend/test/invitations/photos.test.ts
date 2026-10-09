import { expect, test } from 'bun:test';
import { treaty } from '@elysiajs/eden';
import { OWNER_USER_ID } from '#backend/lib/auth/owner-registration.ts';
import { MAX_REFERENCE_PHOTOS } from '#backend/models/invitations/model.ts';
import { InvitationsRepository } from '#backend/repositories/invitations/repository.ts';
import { cookies, fixture, ORIGIN, photo } from './fixture.ts';

const SUCCESS = 200;
const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const CONFLICT = 409;
const FIRST = 1;
const SECOND = 2;
const THIRD = 3;
const FOURTH = 4;
const actor = { userId: OWNER_USER_ID };
const settings = {
  name: 'Ada Lovelace',
  groupName: 'Friends',
  faceScanRequired: false,
  maxGuests: 1,
};
const invalidPhoto = () => new File(['invalid image'], 'invalid.jpg', { type: 'image/jpeg' });

test('Eden multipart saves photos in input order and removal promotes the next private avatar', async () => {
  const f = await fixture();
  try {
    const owner = await f.admin();
    const api = treaty(f.app, { parseDate: false });
    const options = { headers: { origin: ORIGIN, cookie: owner } };
    const created = await api.api.admin.guests.post(
      { ...settings, photos: [photo(FIRST), photo(SECOND), photo(THIRD)] },
      options,
    );
    expect(created.status).toBe(SUCCESS);
    expect(created.error).toBeNull();
    const guest = created.data!;
    expect(guest.references).toHaveLength(THIRD);
    expect(new Set(guest.references.map((reference) => reference.createdAt)).size).toBe(1);
    const stored = await f.management.list({ actor });
    expect(stored.items[0]!.references).toEqual(guest.references);
    for (const [index, reference] of guest.references.entries()) {
      const path = `/api/admin/guests/${guest.id}/photos/${reference.id}`;
      const image = await f.request({ path, cookie: owner });
      expect(image.status).toBe(SUCCESS);
      expect(image.headers.get('cache-control')).toBe('private, no-store');
      expect(new Uint8Array(await image.arrayBuffer())).toEqual(
        new Uint8Array(await photo(index + 1).arrayBuffer()),
      );
      expect((await f.request({ path })).status).toBe(UNAUTHORIZED);
    }
    // Eden sends one removal as a plain multipart string, and many as repeated fields.
    const edited = await api.api.admin.guests({ id: guest.id }).patch(
      {
        ...settings,
        name: 'Ada updated',
        photos: [photo(FOURTH)],
        removedPhotoIds: [guest.references[0]!.id],
      },
      options,
    );
    expect(edited.status).toBe(SUCCESS);
    expect(edited.data!.references.slice(0, SECOND)).toEqual(guest.references.slice(1));
    const final = await api.api.admin.guests({ id: guest.id }).patch(
      {
        ...settings,
        photos: [photo(FIRST), photo(SECOND)],
        removedPhotoIds: edited.data!.references.slice(0, SECOND).map((reference) => reference.id),
      },
      options,
    );
    expect(final.status).toBe(SUCCESS);
    expect(final.data!.references).toHaveLength(THIRD);
    expect(final.data!.references[0]).toEqual(edited.data!.references[SECOND]);
    const untouched = await api.api.admin.guests({ id: guest.id }).patch(settings, options);
    expect(untouched.status).toBe(SUCCESS);
    expect(untouched.data!.references).toEqual(final.data!.references);
    const removed = await f.request({
      path: `/api/admin/guests/${guest.id}/photos/${guest.references[0]!.id}`,
      cookie: owner,
    });
    expect(removed.status).toBe(NOT_FOUND);
  } finally {
    await f.close();
  }
});

test('a bad draft photo leaves no created guest and preserves all edited settings, photos and sessions', async () => {
  const f = await fixture();
  try {
    const owner = await f.admin();
    const api = treaty(f.app, { parseDate: false });
    const options = { headers: { origin: ORIGIN, cookie: owner } };
    const rejected = await api.api.admin.guests.post(
      { ...settings, photos: [photo(FIRST), invalidPhoto()] },
      options,
    );
    expect(rejected.status).toBe(BAD_REQUEST);
    expect(rejected.error?.value).toMatchObject({
      error: 'Photo 2: Use a JPEG, PNG, or WebP photo.',
    });
    expect((await f.management.list({ actor })).items).toEqual([]);
    const guest = await f.management.create({ actor, settings, photos: [photo(FIRST)] });
    const route = `/api/invitations/${guest.token}`;
    const session = cookies(await f.request({ path: `${route}/session`, method: 'POST' }));
    const edited = await api.api.admin.guests({ id: guest.id }).patch(
      {
        ...settings,
        name: 'Must not persist',
        faceScanRequired: true,
        photos: [photo(SECOND), invalidPhoto()],
        removedPhotoIds: [guest.references[0]!.id],
      },
      options,
    );
    expect(edited.status).toBe(BAD_REQUEST);
    expect(await f.management.get({ actor, id: guest.id })).toEqual(guest);
    expect((await f.request({ path: `${route}/content`, cookie: session })).status).toBe(SUCCESS);
    const rows = await f.database`select count(*) as count from invitation_reference`;
    expect(rows[0]!.count).toBe(1);
  } finally {
    await f.close();
  }
});

test('draft photos retain owner, CSRF and per-guest removal boundaries', async () => {
  const f = await fixture();
  try {
    const owner = await f.admin();
    const outsider = await f.admin('outsider');
    const api = treaty(f.app, { parseDate: false });
    const body = { ...settings, photos: [photo(FIRST)] };
    expect((await api.api.admin.guests.post(body, { headers: { origin: ORIGIN } })).status).toBe(
      UNAUTHORIZED,
    );
    expect(
      (await api.api.admin.guests.post(body, { headers: { origin: ORIGIN, cookie: outsider } }))
        .status,
    ).toBe(UNAUTHORIZED);
    expect(
      (
        await api.api.admin.guests.post(body, {
          headers: { origin: 'https://elsewhere.invalid', cookie: owner },
        })
      ).status,
    ).toBe(FORBIDDEN);
    expect((await f.management.list({ actor })).items).toEqual([]);
    const guest = await f.management.create({ actor, settings, photos: [photo(FIRST)] });
    const another = await f.management.create({ actor, settings, photos: [photo(SECOND)] });
    const edited = await api.api.admin.guests({ id: guest.id }).patch(
      {
        ...settings,
        name: 'Must not persist',
        photos: [photo(THIRD)],
        removedPhotoIds: [another.references[0]!.id],
      },
      { headers: { origin: ORIGIN, cookie: owner } },
    );
    expect(edited.status).toBe(NOT_FOUND);
    expect(await f.management.get({ actor, id: guest.id })).toEqual(guest);
    expect(await f.management.get({ actor, id: another.id })).toEqual(another);
    const path = `/api/admin/guests/${guest.id}/photos/${guest.references[0]!.id}`;
    expect((await f.request({ path, cookie: outsider })).status).toBe(UNAUTHORIZED);
  } finally {
    await f.close();
  }
});

test('reference capacity is checked against retained photos and concurrent committed additions', async () => {
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  class PausedEditRepository extends InvitationsRepository {
    override async update(input: Parameters<InvitationsRepository['update']>[0]) {
      entered.resolve();
      await resume.promise;
      return super.update(input);
    }
  }
  const f = await fixture({
    createInvitationsRepository: (database) => new PausedEditRepository(database),
  });
  try {
    const owner = await f.admin();
    const guest = await f.management.create({
      actor,
      settings,
      photos: Array.from({ length: MAX_REFERENCE_PHOTOS - 1 }, () => photo(FIRST)),
    });
    const api = treaty(f.app, { parseDate: false });
    const response = api.api.admin
      .guests({ id: guest.id })
      .patch(
        { ...settings, name: 'Must not persist', photos: [photo(SECOND)] },
        { headers: { origin: ORIGIN, cookie: owner } },
      );
    await entered.promise;
    const concurrent = await f.management.addPhoto({ actor, id: guest.id, photo: photo(FIRST) });
    resume.resolve();
    expect((await response).status).toBe(CONFLICT);
    expect(await f.management.get({ actor, id: guest.id })).toEqual(concurrent);
    expect(concurrent.references).toHaveLength(MAX_REFERENCE_PHOTOS);
    const replacing = await api.api.admin
      .guests({ id: guest.id })
      .patch(
        { ...settings, photos: [photo(THIRD)], removedPhotoIds: [guest.references[0]!.id] },
        { headers: { origin: ORIGIN, cookie: owner } },
      );
    expect(replacing.status).toBe(SUCCESS);
    expect(replacing.data!.references).toHaveLength(MAX_REFERENCE_PHOTOS);
    expect(replacing.data!.references[0]).toEqual(guest.references[1]);
  } finally {
    resume.resolve();
    await f.close();
  }
});

test('a concurrent RSVP prevents an edit from lowering capacity or partially saving its photos and access mode', async () => {
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  class PausedEditRepository extends InvitationsRepository {
    override async update(input: Parameters<InvitationsRepository['update']>[0]) {
      entered.resolve();
      await resume.promise;
      return super.update(input);
    }
  }
  const f = await fixture({
    createInvitationsRepository: (database) => new PausedEditRepository(database),
  });
  try {
    const owner = await f.admin();
    const guest = await f.management.create({ actor, settings, photos: [photo(FIRST)] });
    const route = `/api/invitations/${guest.token}`;
    const session = cookies(await f.request({ path: `${route}/session`, method: 'POST' }));
    const api = treaty(f.app, { parseDate: false });
    const response = api.api.admin.guests({ id: guest.id }).patch(
      {
        ...settings,
        name: 'Must not persist',
        maxGuests: 0,
        faceScanRequired: true,
        photos: [photo(SECOND)],
        removedPhotoIds: [guest.references[0]!.id],
      },
      { headers: { origin: ORIGIN, cookie: owner } },
    );
    await entered.promise;
    const rsvp = await f.request({
      path: `${route}/rsvp`,
      method: 'PUT',
      cookie: session,
      body: { status: 'accepted', companions: ['A companion'] },
    });
    expect(rsvp.status).toBe(SUCCESS);
    resume.resolve();
    expect((await response).status).toBe(CONFLICT);
    expect(await f.management.get({ actor, id: guest.id })).toMatchObject({
      ...settings,
      references: guest.references,
      status: 'accepted',
      companions: [{ name: 'A companion' }],
    });
    expect((await f.request({ path: `${route}/content`, cookie: session })).status).toBe(SUCCESS);
  } finally {
    resume.resolve();
    await f.close();
  }
});
