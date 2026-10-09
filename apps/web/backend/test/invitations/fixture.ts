import { createHash, createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SQL } from 'bun';
import { createApp } from '#backend/app.ts';
import { createSqliteDatabase } from '#backend/db/client.ts';
import { runMigrations } from '#backend/db/migrate.ts';
import { createAuth } from '#backend/lib/auth/better-auth.ts';
import { OWNER_USER_ID } from '#backend/lib/auth/owner-registration.ts';
import type { FaceObservation } from '#backend/models/faces/model.ts';
import {
  FACE_DIMENSIONS,
  FACE_FINGERPRINT_EDGE,
  FACE_MODEL_VERSION,
} from '#backend/models/faces/models.ts';
import { AdminRepository } from '#backend/repositories/admin/repository.ts';
import type { FaceAnalyzer } from '#backend/repositories/faces/analyzer.ts';
import { InvitationsRepository } from '#backend/repositories/invitations/repository.ts';
import { WeddingRepository } from '#backend/repositories/wedding/repository.ts';
import { GuestAccessService } from '#backend/services/invitations/guest-access.ts';
import { GuestManagementService } from '#backend/services/invitations/guest-management.ts';
import { WeddingService } from '#backend/services/wedding/service.ts';
export const ORIGIN = 'http://localhost:3000';
export const EXAMPLE_WEDDING = { coupleNames: 'Alex & Sam', date: '2028-09-16' };
const SECRET = 'invitation-test-secret-at-least-thirty-two-characters';
const FACE_ID_OFFSET = 3;
const DIFFERENT_PERSON = 3;
const NORMALIZED_PIXEL_MAX = 255;
const PIXEL_MULTIPLIER = 37;
const PIXEL_ID_MULTIPLIER = 71;
export function observation(id: number): FaceObservation {
  const embedding = Array<number>(FACE_DIMENSIONS).fill(0);
  embedding[id === DIFFERENT_PERSON ? 1 : 0] = 1;
  const pixels = new Uint8Array(FACE_FINGERPRINT_EDGE ** 2);
  for (const index of pixels.keys()) {
    pixels[index] = (index * PIXEL_MULTIPLIER + id * PIXEL_ID_MULTIPLIER) % NORMALIZED_PIXEL_MAX;
  }
  return {
    embedding,
    modelVersion: FACE_MODEL_VERSION,
    fingerprint: JSON.stringify({
      sha256: createHash('sha256').update(String(id)).digest('hex'),
      pixels: Buffer.from(pixels).toString('base64'),
      descriptors: '',
    }),
  };
}
export function photo(id: number) {
  return new File(
    [Buffer.concat([Buffer.from('ffd8ff', 'hex'), Buffer.from([id])])],
    'selfie.jpg',
    { type: 'image/jpeg' },
  );
}
export function upload(id: number) {
  const body = new FormData();
  body.set('photo', photo(id));
  return body;
}
export function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
}
export async function fixture(
  input: {
    createInvitationsRepository?: (database: SQL) => InvitationsRepository;
    weddingConfigured?: boolean;
  } = {},
) {
  const folder = await mkdtemp(join(tmpdir(), 'wedding-api-test-'));
  const database = await createSqliteDatabase({ dataFolder: folder });
  await runMigrations({ db: database });
  const faces: FaceAnalyzer = {
    analyze: (input) => Promise.resolve(observation(input.image[FACE_ID_OFFSET]!)),
  };
  const guests =
    input.createInvitationsRepository?.(database) ?? new InvitationsRepository(database);
  const management = new GuestManagementService({
    guests,
    faces,
    admin: new AdminRepository(database),
  });
  const weddingRepository = new WeddingRepository(database);
  const wedding = new WeddingService(weddingRepository);
  const auth = createAuth({ database, baseUrl: new URL(ORIGIN), secret: SECRET });
  const app = createApp({
    auth,
    management,
    wedding,
    access: new GuestAccessService({ guests, faces, wedding: weddingRepository }),
    origin: ORIGIN,
    frontend: { routes: () => new Map(), fallback: () => null },
  });
  async function admin(userId = OWNER_USER_ID) {
    const token = `session-${userId}`;
    const now = new Date().toISOString();
    const expiry = '2030-01-01T00:00:00.000Z';
    await database`insert into auth_user (id,name,email,emailVerified,createdAt,updatedAt) values (${userId}, ${userId}, ${`${userId}@test.invalid`}, 1, ${now}, ${now})`;
    await database`insert into auth_session (id,token,userId,expiresAt,createdAt,updatedAt) values (${token}, ${token}, ${userId}, ${expiry}, ${now}, ${now})`;
    if (userId === OWNER_USER_ID && input.weddingConfigured !== false) {
      await wedding.save({ actor: { userId }, settings: EXAMPLE_WEDDING });
    }
    const signature = createHmac('sha256', SECRET).update(token).digest('base64');
    return `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
  }
  function request(input: {
    path: string;
    method?: string;
    cookie?: string;
    origin?: string;
    body?: unknown;
  }) {
    const headers = new Headers({ origin: input.origin ?? ORIGIN });
    if (input.cookie) {
      headers.set('cookie', input.cookie);
    }
    let body: BodyInit | undefined;
    if (input.body instanceof FormData) {
      body = input.body;
    } else if (input.body !== undefined) {
      headers.set('content-type', 'application/json');
      body = JSON.stringify(input.body);
    }
    return app.handle(
      new Request(`${ORIGIN}${input.path}`, { method: input.method ?? 'GET', headers, body }),
    );
  }
  return {
    database,
    folder,
    wedding,
    weddingRepository,
    guests,
    management,
    app,
    admin,
    request,
    async close() {
      await database.close();
      await rm(folder, { recursive: true, force: true });
    },
  };
}
