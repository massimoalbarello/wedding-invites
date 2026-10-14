const HTTP_NOT_FOUND = 404;
const HTTP_UNAUTHORIZED = 401;
const HTTP_OK = 200;
const INVITATION_TOKEN_LENGTH = 48;

import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startBinary } from '@repo/build-tools/binary-check';
import { SQL } from 'bun';
import { OWNER_USER_ID } from '../backend/src/lib/auth/owner-registration';
import { opaqueId } from '../backend/src/lib/opaque-id';
import { InvitationsRepository } from '../backend/src/repositories/invitations/repository';

test('standalone binary embeds frontend and migrations and preserves state on restart', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'binary-test-'));
  try {
    const executable = join(import.meta.dir, '../dist/app');
    const dataFolder = join(folder, 'data');
    await using app = await startBinary({
      executable,
      cwd: folder,
      env: { DATA_FOLDER: dataFolder, BASE_URL: 'http://localhost:3000' },
    });
    expect((await app.request({ path: '/api/health' })).status).toBe(HTTP_OK);
    expect((await app.request({ path: '/api/auth/get-session' })).status).toBe(HTTP_OK);
    const html = await (await app.request({ path: '/' })).text();
    expect(html).toContain('id="root"');
    const asset = html.match(/src="([^"]+\.js)"/)?.[1];
    expect(asset).toBeDefined();
    const javascript = await app.request({ path: asset! });
    expect(javascript.status).toBe(HTTP_OK);
    expect(javascript.headers.get('content-type')).toContain('javascript');
    expect((await app.request({ path: '/api/missing' })).status).toBe(HTTP_NOT_FOUND);
    expect((await app.request({ path: '/missing.js' })).status).toBe(HTTP_NOT_FOUND);
    expect((await app.request({ path: '/login' })).status).toBe(HTTP_OK);
    expect((await app.request({ path: '/api/admin/guests' })).status).toBe(HTTP_UNAUTHORIZED);
    const absentInvitation = `/api/invitations/${'0'.repeat(INVITATION_TOKEN_LENGTH)}/content`;
    expect((await app.request({ path: absentInvitation })).status).toBe(HTTP_NOT_FOUND);
    await app.stop();
    const secret = await Bun.file(join(dataFolder, '.better-auth-secret')).text();
    const invitationToken = opaqueId();
    const db = new SQL({ adapter: 'sqlite', filename: join(dataFolder, 'app.db') });
    try {
      const migrations = await db`select name from __migrations`;
      expect(migrations).toContainEqual({ name: '0002_invitations.sql' });
      expect(migrations).toContainEqual({ name: '0003_wedding_settings.sql' });
      const now = new Date().toISOString();
      await db`insert into auth_user (id,name,email,emailVerified,createdAt,updatedAt) values (${OWNER_USER_ID}, 'Owner', 'owner@test.invalid', 1, ${now}, ${now})`;
      await new InvitationsRepository(db).create({
        guest: {
          id: crypto.randomUUID(),
          publicId: crypto.randomUUID(),
          ownerId: OWNER_USER_ID,
          token: invitationToken,
          name: 'Binary guest',
          groupName: '',
          maxGuests: 1,
          status: 'pending',
          active: true,
          createdAt: now,
          companions: [],
          references: [],
        },
        references: [],
      });
    } finally {
      await db.close();
    }
    await using restarted = await startBinary({
      executable,
      cwd: folder,
      env: { DATA_FOLDER: dataFolder, BASE_URL: 'http://localhost:3000' },
    });
    expect((await restarted.request({ path: '/api/health' })).status).toBe(HTTP_OK);
    expect(await Bun.file(join(dataFolder, '.better-auth-secret')).text()).toBe(secret);
    const prefix = `/api/invitations/${invitationToken}`;
    expect((await restarted.request({ path: `${prefix}/assets/index.html` })).status).toBe(
      HTTP_UNAUTHORIZED,
    );
    const opened = await restarted.request({
      path: `${prefix}/session`,
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(opened.status).toBe(HTTP_OK);
    const cookie = opened.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
    const content = (await (
      await restarted.request({ path: `${prefix}/content`, headers: { cookie } })
    ).json()) as { assetUrl: string };
    const document = await restarted.request({ path: content.assetUrl, headers: { cookie } });
    const invitationHtml = await document.text();
    expect(document.status).toBe(HTTP_OK);
    const invitationScript = invitationHtml.match(/src="([^"]+\.js)"/)?.[1];
    expect(invitationScript).toBeDefined();
    const scriptPath = `${prefix}/assets/${invitationScript!.replace(/^\.\//, '')}`;
    expect((await restarted.request({ path: scriptPath, headers: { cookie } })).status).toBe(
      HTTP_OK,
    );
    const media = await restarted.request({
      path: `${prefix}/assets/media/envelope.mp4`,
      headers: { cookie, range: 'bytes=0-31' },
    });
    const PARTIAL_CONTENT = 206;
    const HEADER_BYTES = 32;
    expect(media.status).toBe(PARTIAL_CONTENT);
    expect((await media.arrayBuffer()).byteLength).toBe(HEADER_BYTES);
    expect((await restarted.request({ path: scriptPath })).status).toBe(HTTP_UNAUTHORIZED);
    await restarted.stop();
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
