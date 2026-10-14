import { openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import type { Auth } from '#backend/lib/auth/better-auth.ts';
import { elysiaErrorHandler } from '#backend/lib/errors.ts';
import { createAdminController } from '#backend/routes/api/admin/controller.ts';
import { createInvitationsController } from '#backend/routes/api/invitations/controller.ts';
import type { FrontendAssetsServiceContract } from '#backend/services/frontend-assets/service.ts';
import type { GuestAccessServiceContract } from '#backend/services/invitations/guest-access.ts';
import type { GuestManagementServiceContract } from '#backend/services/invitations/guest-management.ts';
export function createApp(input: {
  auth: Auth;
  management: GuestManagementServiceContract;
  access: GuestAccessServiceContract;
  frontend: FrontendAssetsServiceContract;
  origin: string;
}) {
  const frontendRoutes = input.frontend.routes();
  return new Elysia()
    .onError(elysiaErrorHandler)
    .onRequest(({ set, request }) => {
      set.headers['referrer-policy'] = 'no-referrer';
      set.headers['x-content-type-options'] = 'nosniff';
      if (new URL(request.url).pathname.startsWith('/api/')) {
        set.headers['cache-control'] = 'private, no-store';
      }
    })
    .use(
      openapi({ documentation: { info: { title: 'Wedding invitations API', version: '1.0.0' } } }),
    )
    .group('/api', (app) =>
      app
        .get('/health', () => ({ status: 'ok' }))
        .all('/auth/*', ({ request }) => input.auth.handler(request), {
          parse: 'none',
          detail: { hide: true },
        })
        .use(createAdminController(input))
        .use(createInvitationsController(input)),
    )
    .all('/*', ({ path, request, status }) => {
      if (request.method !== 'GET' || path === '/api' || path.startsWith('/api/')) {
        return status('Not Found', { error: 'Not Found' });
      }
      return (
        frontendRoutes.get(path)?.clone() ??
        input.frontend.fallback(path) ??
        status('Not Found', { error: 'Not Found' })
      );
    });
}
export type App = ReturnType<typeof createApp>;
