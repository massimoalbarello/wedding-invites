import { Elysia, t } from 'elysia';
import type { Auth } from '#backend/lib/auth/better-auth.ts';
import { ForbiddenError, UnauthorizedError } from '#backend/lib/errors.ts';
import {
  GuestListQuerySchema,
  GuestParamsSchema,
  GuestSchema,
  GuestSettingsSchema,
  PhotoParamsSchema,
  PhotoUploadSchema,
  StatsSchema,
} from '#backend/routes/api/admin/model.ts';
import { apiResponse } from '#backend/routes/api/response.ts';
import type { GuestManagementServiceContract } from '#backend/services/invitations/guest-management.ts';
export function createAdminController(input: {
  auth: Auth;
  management: GuestManagementServiceContract;
  origin: string;
}) {
  return new Elysia({ prefix: '/admin' })
    .get('/status', () => input.management.status(), {
      response: apiResponse(t.Object({ hasOwner: t.Boolean() })),
    })
    .guard({}, (app) =>
      app
        .resolve(async ({ request }) => {
          const session = await input.auth.getSession({ headers: request.headers });
          if (!session) {
            throw new UnauthorizedError();
          }
          if (request.method !== 'GET' && request.headers.get('origin') !== input.origin) {
            throw new ForbiddenError('Invalid request origin.');
          }
          return { actor: { userId: session.user.id } };
        })
        .get('/stats', ({ actor }) => input.management.stats({ actor }), {
          response: apiResponse(StatsSchema),
        })
        .get('/groups', ({ actor }) => input.management.groups({ actor }), {
          response: apiResponse(t.Array(t.String())),
        })
        .get('/guests', ({ actor, query }) => input.management.list({ actor, ...query }), {
          query: GuestListQuerySchema,
          response: apiResponse(
            t.Object({
              items: t.Array(GuestSchema),
              nextCursor: t.Union([t.String(), t.Null()]),
            }),
          ),
        })
        .post('/guests', ({ actor, body }) => input.management.create({ actor, settings: body }), {
          body: GuestSettingsSchema,
          response: apiResponse(GuestSchema),
        })
        .get('/guests/:id', ({ actor, params }) => input.management.get({ actor, id: params.id }), {
          params: GuestParamsSchema,
          response: apiResponse(GuestSchema),
        })
        .patch(
          '/guests/:id',
          ({ actor, params, body }) =>
            input.management.update({ actor, id: params.id, settings: body }),
          {
            params: GuestParamsSchema,
            body: GuestSettingsSchema,
            response: apiResponse(GuestSchema),
          },
        )
        .post(
          '/guests/:id/access',
          ({ actor, params, body }) =>
            input.management.setAccess({ actor, id: params.id, active: body.active }),
          {
            params: GuestParamsSchema,
            body: t.Object({ active: t.Boolean() }),
            response: apiResponse(GuestSchema),
          },
        )
        .post(
          '/guests/:id/rotate',
          ({ actor, params }) => input.management.rotate({ actor, id: params.id }),
          { params: GuestParamsSchema, response: apiResponse(GuestSchema) },
        )
        .delete(
          '/guests/:id/sessions',
          ({ actor, params }) => input.management.revokeSessions({ actor, id: params.id }),
          { params: GuestParamsSchema, response: apiResponse(t.Object({ revoked: t.Boolean() })) },
        )
        .post(
          '/guests/:id/photos',
          ({ actor, params, body }) =>
            input.management.addPhoto({ actor, id: params.id, photo: body.photo }),
          {
            params: GuestParamsSchema,
            body: PhotoUploadSchema,
            response: apiResponse(GuestSchema),
          },
        )
        .get(
          '/guests/:id/photos/:photoId',
          async ({ actor, params }) => {
            const photo = await input.management.photo({
              actor,
              id: params.id,
              photoId: params.photoId,
            });
            return new Response(
              new Blob([new Uint8Array(photo.image)], { type: photo.mediaType }),
              {
                headers: {
                  'cache-control': 'private, no-store',
                  'x-content-type-options': 'nosniff',
                },
              },
            );
          },
          { params: PhotoParamsSchema },
        )
        .delete(
          '/guests/:id/photos/:photoId',
          ({ actor, params }) =>
            input.management.removePhoto({ actor, id: params.id, photoId: params.photoId }),
          { params: PhotoParamsSchema, response: apiResponse(GuestSchema) },
        ),
    );
}
