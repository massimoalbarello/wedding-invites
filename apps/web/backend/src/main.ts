import { createApp } from '#backend/app.ts';
import { createSqliteDatabase } from '#backend/db/client.ts';
import { runMigrations } from '#backend/db/migrate.ts';
import { loadAuthSecret } from '#backend/lib/auth/auth-secret.ts';
import { createAuth } from '#backend/lib/auth/better-auth.ts';
import { loadEnv } from '#backend/lib/env.ts';
import { MAX_PHOTO_BYTES } from '#backend/models/invitations/model.ts';
import { AdminRepository } from '#backend/repositories/admin/repository.ts';
import { createLocalFaceAnalyzer } from '#backend/repositories/faces/local-analyzer.ts';
import { FrontendAssetsRepository } from '#backend/repositories/frontend-assets/repository.ts';
import { InvitationsRepository } from '#backend/repositories/invitations/repository.ts';
import { FrontendAssetsService } from '#backend/services/frontend-assets/service.ts';
import { GuestAccessService } from '#backend/services/invitations/guest-access.ts';
import { GuestManagementService } from '#backend/services/invitations/guest-management.ts';

const MULTIPART_OVERHEAD_BYTES = 65_536;
const env = loadEnv();
const secret = await loadAuthSecret({
  dataFolder: env.DATA_FOLDER,
  environmentSecret: env.BETTER_AUTH_SECRET,
});
const database = await createSqliteDatabase({ dataFolder: env.DATA_FOLDER });
const faces = createLocalFaceAnalyzer({ dataFolder: env.DATA_FOLDER });
try {
  await runMigrations({ db: database });
  const guests = new InvitationsRepository(database);
  const app = createApp({
    auth: createAuth({
      database,
      baseUrl: env.BASE_URL,
      nibrunHostname: env.NIBRUN_HOSTNAME,
      secret: secret.value,
    }),
    management: new GuestManagementService({ guests, admin: new AdminRepository(database), faces }),
    access: new GuestAccessService({ guests, faces }),
    frontend: new FrontendAssetsService(new FrontendAssetsRepository()),
    origin: env.BASE_URL.origin,
  }).listen({
    port: env.PORT,
    hostname: '0.0.0.0',
    maxRequestBodySize: MAX_PHOTO_BYTES + MULTIPART_OVERHEAD_BYTES,
  });
  console.log(`Application listening on http://0.0.0.0:${app.server!.port}`);
  let stopping = false;
  const stop = async () => {
    if (stopping) {
      return;
    }
    stopping = true;
    await app.stop();
    await faces.close();
    await database.close();
  };
  process.once('SIGTERM', () => {
    void stop();
  });
  process.once('SIGINT', () => {
    void stop();
  });
} catch (error) {
  await faces.close();
  await database.close();
  throw error;
}
