import { expect, test } from 'bun:test';
import { OWNER_USER_ID } from '#backend/lib/auth/owner-registration.ts';
import { InvitationDesignsRepository } from '#backend/repositories/invitation-designs/repository.ts';
import { cookies, fixture } from './fixture';

const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const SUCCESS = 200;

test('one owner selection applies to existing guest links and preserves their independent replies', async () => {
  const f = await fixture({
    packages: new Map([
      ['amalfi', new Map([['index.html', new Blob(['Amalfi letter'], { type: 'text/html' })]])],
      ['minimal', new Map([['index.html', new Blob(['Simple letter'], { type: 'text/html' })]])],
    ]),
  });
  try {
    const owner = await f.admin();
    const outsider = await f.admin('outsider');
    expect((await f.request({ path: '/api/admin/designs' })).status).toBe(UNAUTHORIZED);
    expect((await f.request({ path: '/api/admin/designs', cookie: outsider })).status).toBe(
      UNAUTHORIZED,
    );
    expect((await f.request({ path: '/api/admin/designs/minimal/assets/index.html' })).status).toBe(
      UNAUTHORIZED,
    );
    expect(
      (await f.request({ path: '/api/admin/designs/minimal/assets/index.html', cookie: outsider }))
        .status,
    ).toBe(UNAUTHORIZED);
    const initial = await (await f.request({ path: '/api/admin/designs', cookie: owner })).json();
    expect(initial.selectedPackageId).toBe('amalfi');
    const guests = [];
    for (const name of ['Alex', 'Sam']) {
      const guest = await f.management.create({
        actor: { userId: OWNER_USER_ID },
        settings: { name, groupName: '', maxGuests: 1 },
      });
      const prefix = `/api/invitations/${guest.token}`;
      const session = cookies(await f.request({ path: `${prefix}/session`, method: 'POST' }));
      guests.push({ guest, prefix, session });
    }
    const first = guests[0]!;
    await f.request({
      path: `${first.prefix}/rsvp`,
      method: 'PUT',
      cookie: first.session,
      body: { status: 'accepted', companions: ['Jordan'] },
    });
    const preview = await f.request({
      path: '/api/admin/designs/minimal/assets/index.html',
      cookie: owner,
    });
    expect(await preview.text()).toBe('Simple letter');
    expect((await f.designs.list({ actor: { userId: OWNER_USER_ID } })).selectedPackageId).toBe(
      'amalfi',
    );
    expect(
      (
        await f.request({
          path: '/api/admin/designs',
          method: 'PUT',
          cookie: owner,
          origin: 'https://other.test',
          body: { packageId: 'minimal' },
        })
      ).status,
    ).toBe(FORBIDDEN);
    expect(
      (
        await f.request({
          path: '/api/admin/designs',
          method: 'PUT',
          cookie: owner,
          body: { packageId: 'missing' },
        })
      ).status,
    ).toBe(NOT_FOUND);
    expect((await f.designs.list({ actor: { userId: OWNER_USER_ID } })).selectedPackageId).toBe(
      'amalfi',
    );
    const changed = await f.request({
      path: '/api/admin/designs',
      method: 'PUT',
      cookie: owner,
      body: { packageId: 'minimal' },
    });
    expect(changed.status).toBe(SUCCESS);
    await expect(
      new InvitationDesignsRepository({ database: f.database, defaultPackageId: 'amalfi' }).get({
        ownerId: OWNER_USER_ID,
      }),
    ).resolves.toBe('minimal');
    for (const entry of guests) {
      const content = await (
        await f.request({ path: `${entry.prefix}/content`, cookie: entry.session })
      ).json();
      expect(content.assetUrl).toBe(`${entry.prefix}/assets/minimal/index.html`);
      expect(content.name).toBe(entry.guest.name);
      expect(content.maxGuests).toBe(1);
      expect(
        await (await f.request({ path: content.assetUrl, cookie: entry.session })).text(),
      ).toBe('Simple letter');
      expect(
        (
          await f.request({
            path: `${entry.prefix}/assets/amalfi/index.html`,
            cookie: entry.session,
          })
        ).status,
      ).toBe(NOT_FOUND);
    }
    const reply = await (
      await f.request({ path: `${first.prefix}/content`, cookie: first.session })
    ).json();
    expect(reply.status).toBe('accepted');
    expect(reply.companions.map((guest: { name: string }) => guest.name)).toEqual(['Jordan']);
    const second = guests[1]!;
    expect(
      (await (await f.request({ path: `${second.prefix}/content`, cookie: second.session })).json())
        .status,
    ).toBe('pending');
  } finally {
    await f.close();
  }
});
