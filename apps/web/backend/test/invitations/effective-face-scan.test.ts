import { expect, test } from 'bun:test';
import { treaty } from '@elysiajs/eden';
import { OWNER_USER_ID } from '#backend/lib/auth/owner-registration.ts';
import { InvitationsRepository } from '#backend/repositories/invitations/repository.ts';
import { cookies, fixture, ORIGIN, photo, upload } from './fixture.ts';

const SUCCESS = 200;
const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const REFERENCE = 1;
const ALTERNATE_REFERENCE = 2;
const SELFIE = 4;
const actor = { userId: OWNER_USER_ID };
const settings = { name: 'Ada Lovelace', groupName: '', maxGuests: 0 };

test('a default guest without photos opens directly and can RSVP', async () => {
  const f = await fixture();
  try {
    const owner = await f.admin();
    const created = await f.request({
      path: '/api/admin/guests',
      method: 'POST',
      cookie: owner,
      body: { name: settings.name },
    });
    expect(created.status).toBe(SUCCESS);
    const guest = await created.json();
    expect(guest).toMatchObject({ faceScanRequired: false, references: [] });
    const route = `/api/invitations/${guest.token}`;
    expect(await (await f.request({ path: route })).json()).toEqual({
      name: settings.name,
      faceScanRequired: false,
      authenticated: false,
    });
    expect((await f.request({ path: `${route}/content` })).status).toBe(UNAUTHORIZED);
    const login = await f.request({ path: `${route}/session`, method: 'POST' });
    expect(login.status).toBe(SUCCESS);
    expect(login.headers.get('set-cookie')).toContain('HttpOnly');
    const session = cookies(login);
    expect((await f.request({ path: `${route}/content`, cookie: session })).status).toBe(SUCCESS);
    const rsvp = await f.request({
      path: `${route}/rsvp`,
      method: 'PUT',
      cookie: session,
      body: { status: 'accepted', companions: [] },
    });
    expect(rsvp.status).toBe(SUCCESS);
    expect((await rsvp.json()).status).toBe('accepted');
    const staleCamera = await f.request({
      path: `${route}/verify`,
      method: 'POST',
      body: upload(SELFIE),
    });
    expect(staleCamera.status).toBe(SUCCESS);
    expect((await f.management.get({ actor, id: guest.id })).faceScanRequired).toBe(false);
  } finally {
    await f.close();
  }
});

test.each(['atomic', 'legacy'])(
  '%s photo edits revoke sessions only when effective access changes',
  async (mode) => {
    const f = await fixture();
    try {
      const owner = await f.admin();
      const api = treaty(f.app, { parseDate: false });
      const options = { headers: { cookie: owner, origin: ORIGIN } };
      const guestSettings = settings;
      const guest = await f.management.create({ actor, settings: guestSettings });
      const route = `/api/invitations/${guest.token}`;
      const login = () => f.request({ path: `${route}/session`, method: 'POST' });
      const addPhoto = async (id: number) => {
        const response =
          mode === 'atomic'
            ? await api.api.admin
                .guests({ id: guest.id })
                .patch({ ...guestSettings, photos: [photo(id)] }, options)
            : await api.api.admin
                .guests({ id: guest.id })
                .photos.post({ photo: photo(id) }, options);
        expect(response.status).toBe(SUCCESS);
        return response.data!;
      };
      const removePhoto = async (id: string) => {
        const response =
          mode === 'atomic'
            ? await api.api.admin
                .guests({ id: guest.id })
                .patch({ ...guestSettings, removedPhotoIds: [id] }, options)
            : await api.api.admin
                .guests({ id: guest.id })
                .photos({ photoId: id })
                .delete(undefined, options);
        expect(response.status).toBe(SUCCESS);
        return response.data!;
      };
      const bypassSession = cookies(await login());
      const first = await addPhoto(REFERENCE);
      expect(first.faceScanRequired).toBe(true);
      expect((await (await f.request({ path: route })).json()).faceScanRequired).toBe(true);
      expect((await f.request({ path: `${route}/content`, cookie: bypassSession })).status).toBe(
        UNAUTHORIZED,
      );
      expect((await login()).status).toBe(FORBIDDEN);
      const verified = await f.request({
        path: `${route}/verify`,
        method: 'POST',
        body: upload(SELFIE),
      });
      expect(verified.status).toBe(SUCCESS);
      const session = cookies(verified);
      const second = await addPhoto(ALTERNATE_REFERENCE);
      expect((await f.request({ path: `${route}/content`, cookie: session })).status).toBe(SUCCESS);
      await removePhoto(first.references[0]!.id);
      expect((await (await f.request({ path: route })).json()).faceScanRequired).toBe(true);
      expect((await f.request({ path: `${route}/content`, cookie: session })).status).toBe(SUCCESS);
      const emptied = await removePhoto(second.references[1]!.id);
      expect(emptied).toMatchObject({ faceScanRequired: false, references: [] });
      expect((await (await f.request({ path: route })).json()).faceScanRequired).toBe(false);
      expect((await f.request({ path: `${route}/content`, cookie: session })).status).toBe(
        UNAUTHORIZED,
      );
      const direct = await login();
      expect(direct.status).toBe(SUCCESS);
      expect((await f.request({ path: `${route}/content`, cookie: cookies(direct) })).status).toBe(
        SUCCESS,
      );
    } finally {
      await f.close();
    }
  },
);

test('a bypass started before the first reference is saved cannot create a session afterward', async () => {
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  class PausedSessionRepository extends InvitationsRepository {
    override async createSession(input: Parameters<InvitationsRepository['createSession']>[0]) {
      entered.resolve();
      await resume.promise;
      return super.createSession(input);
    }
  }
  const f = await fixture({
    createInvitationsRepository: (database) => new PausedSessionRepository(database),
  });
  try {
    await f.admin();
    const guest = await f.management.create({ actor, settings });
    const route = `/api/invitations/${guest.token}`;
    const login = f.request({ path: `${route}/session`, method: 'POST' });
    await entered.promise;
    await f.management.addPhoto({ actor, id: guest.id, photo: photo(REFERENCE) });
    resume.resolve();
    const response = await login;
    expect(response.status).toBe(NOT_FOUND);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect((await (await f.request({ path: route })).json()).faceScanRequired).toBe(true);
    expect((await f.database`select count(*) as count from invitation_session`)[0]!.count).toBe(0);
  } finally {
    resume.resolve();
    await f.close();
  }
});

test('a failed first-photo upload leaves direct access and existing sessions unchanged', async () => {
  const f = await fixture();
  try {
    const owner = await f.admin();
    const api = treaty(f.app, { parseDate: false });
    const options = { headers: { cookie: owner, origin: ORIGIN } };
    const guest = await f.management.create({ actor, settings });
    const route = `/api/invitations/${guest.token}`;
    const session = cookies(await f.request({ path: `${route}/session`, method: 'POST' }));
    const invalid = new File(['not an image'], 'bad.jpg', { type: 'image/jpeg' });
    const edit = await api.api.admin
      .guests({ id: guest.id })
      .patch({ ...settings, name: 'Must not persist', photos: [invalid] }, options);
    expect(edit.status).toBe(BAD_REQUEST);
    expect(
      (await api.api.admin.guests({ id: guest.id }).photos.post({ photo: invalid }, options))
        .status,
    ).toBe(BAD_REQUEST);
    expect(await f.management.get({ actor, id: guest.id })).toEqual(guest);
    expect((await (await f.request({ path: route })).json()).faceScanRequired).toBe(false);
    expect((await f.request({ path: `${route}/content`, cookie: session })).status).toBe(SUCCESS);
  } finally {
    await f.close();
  }
});

test('a request cannot override photo-based verification through the read-only access field', async () => {
  const f = await fixture();
  try {
    const owner = await f.admin();
    const body = new FormData();
    body.set('name', settings.name);
    body.set('faceScanRequired', 'false');
    body.set('photos', photo(REFERENCE));
    const created = await f.request({
      path: '/api/admin/guests',
      method: 'POST',
      cookie: owner,
      body,
    });
    expect(created.status).toBe(SUCCESS);
    const guest = await created.json();
    expect(guest.faceScanRequired).toBe(true);
    const patched = await f.request({
      path: `/api/admin/guests/${guest.id}`,
      method: 'PATCH',
      cookie: owner,
      body: { ...settings, faceScanRequired: false },
    });
    expect(patched.status).toBe(SUCCESS);
    expect((await patched.json()).faceScanRequired).toBe(true);
    expect(
      (await f.request({ path: `/api/invitations/${guest.token}/session`, method: 'POST' })).status,
    ).toBe(FORBIDDEN);
  } finally {
    await f.close();
  }
});
