import { expect, test } from 'bun:test';
import { OWNER_USER_ID } from '#backend/lib/auth/owner-registration.ts';
import { opaqueId } from '#backend/lib/opaque-id.ts';
import { fixture, photo } from './fixture.ts';

const SUCCESS = 200;
const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const BAD_REQUEST = 400;
const actor = { userId: OWNER_USER_ID };
const settings = { name: 'Private guest name', groupName: 'Friends', maxGuests: 0 };
const frontendAssets = new Map([
  [
    '/index.html',
    new Blob(
      [
        '<!doctype html><html><head><title>A personal message</title></head><body><div id="root"></div><script src="/assets/app.js"></script></body></html>',
      ],
      { type: 'text/html' },
    ),
  ],
]);

test('guest links serve crawler-readable previews without opening or authorizing the invitation', async () => {
  const f = await fixture({ frontendAssets });
  try {
    await f.admin();
    for (const requiresFace of [true, false]) {
      const guest = await f.management.create({
        actor,
        settings,
        photos: requiresFace ? [photo(1)] : [],
      });
      const title = requiresFace ? 'A top secret message' : 'You are invited to my wedding';
      for (const suffix of ['', '/', '/invitation']) {
        const response = await f.request({ path: `/i/${guest.token}${suffix}` });
        expect(response.status).toBe(SUCCESS);
        expect(response.headers.get('content-type')).toContain('text/html');
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        expect(response.headers.get('set-cookie')).toBeNull();
        const html = await response.text();
        expect(html).toContain(`<title>${title}</title>`);
        for (const attribute of [
          'name="description"',
          'property="og:title"',
          'property="og:description"',
          'name="twitter:title"',
          'name="twitter:description"',
        ]) {
          expect(html).toContain(`<meta ${attribute} content="${title}">`);
        }
        expect(html).toContain('<script src="/assets/app.js"></script>');
        expect(html).not.toContain(settings.name);
        expect(html).not.toContain('Private invitation');
      }
      expect((await f.management.get({ actor, id: guest.id })).activity).toEqual({
        linkOpenedAt: null,
        verificationFailedAt: null,
        verifiedAt: null,
        invitationOpenedAt: null,
      });
      expect((await f.request({ path: `/api/invitations/${guest.token}/content` })).status).toBe(
        UNAUTHORIZED,
      );
    }
    expect((await f.database`select count(*) as count from invitation_session`)[0]!.count).toBe(0);
    const generic = await f.request({ path: '/' });
    expect(await generic.text()).toContain('<title>A personal message</title>');
  } finally {
    await f.close();
  }
});

test('previews follow photo changes and stop resolving revoked, rotated, or unknown links', async () => {
  const f = await fixture({ frontendAssets });
  try {
    await f.admin();
    const guest = await f.management.create({ actor, settings });
    const preview = () => f.request({ path: `/i/${guest.token}` });
    expect(await (await preview()).text()).toContain('You are invited to my wedding');
    const withPhoto = await f.management.addPhoto({ actor, id: guest.id, photo: photo(1) });
    expect(await (await preview()).text()).toContain('A top secret message');
    await f.management.removePhoto({ actor, id: guest.id, photoId: withPhoto.references[0]!.id });
    expect(await (await preview()).text()).toContain('You are invited to my wedding');
    await f.management.setAccess({ actor, id: guest.id, active: false });
    const revoked = await preview();
    expect(revoked.status).toBe(NOT_FOUND);
    expect(await revoked.text()).toContain('<title>A personal message</title>');
    await f.management.setAccess({ actor, id: guest.id, active: true });
    const rotated = await f.management.rotate({ actor, id: guest.id });
    expect((await preview()).status).toBe(NOT_FOUND);
    expect((await f.request({ path: `/i/${rotated.token}` })).status).toBe(SUCCESS);
    expect((await f.request({ path: `/i/${opaqueId()}` })).status).toBe(NOT_FOUND);
    expect((await f.request({ path: '/i/invalid-token' })).status).toBe(BAD_REQUEST);
  } finally {
    await f.close();
  }
});
