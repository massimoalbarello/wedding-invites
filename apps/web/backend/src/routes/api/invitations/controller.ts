import { Elysia, t } from 'elysia';
import { ForbiddenError } from '#backend/lib/errors.ts';
import { SESSION_MAX_AGE_SECONDS } from '#backend/models/invitations/model.ts';
import { PhotoUploadSchema, PublicIdSchema } from '#backend/routes/api/admin/model.ts';
import {
  InvitationContentSchema,
  InvitationEntrySchema,
  InvitationParamsSchema,
  RsvpSchema,
} from '#backend/routes/api/invitations/model.ts';
import { apiResponse } from '#backend/routes/api/response.ts';
import type { GuestAccessServiceContract } from '#backend/services/invitations/guest-access.ts';
export const GUEST_COOKIE_NAME = 'invitation_session';
export function createInvitationsController(input: {
  access: GuestAccessServiceContract;
  origin: string;
}) {
  const cookieOptions = {
    httpOnly: true,
    secure: new URL(input.origin).protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/api/invitations',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
  return new Elysia({ prefix: '/invitations' })
    .guard({ cookie: t.Cookie({ invitation_session: t.Optional(PublicIdSchema) }) })
    .onBeforeHandle(({ request }) => {
      if (request.method !== 'GET' && request.headers.get('origin') !== input.origin) {
        throw new ForbiddenError('Invalid request origin.');
      }
    })
    .get(
      '/:token',
      ({ params, cookie }) =>
        input.access.entry({
          token: params.token,
          session: cookie[GUEST_COOKIE_NAME]?.value as string | undefined,
        }),
      { params: InvitationParamsSchema, response: apiResponse(InvitationEntrySchema) },
    )
    .post(
      '/:token/session',
      async ({ params, cookie }) => {
        const session = await input.access.bypass(params.token);
        cookie[GUEST_COOKIE_NAME]!.set({ ...cookieOptions, value: session });
        return { authenticated: true };
      },
      {
        params: InvitationParamsSchema,
        response: apiResponse(t.Object({ authenticated: t.Boolean() })),
      },
    )
    .post(
      '/:token/verify',
      async ({ params, body, cookie }) => {
        const session = await input.access.verify({ token: params.token, photo: body.photo });
        cookie[GUEST_COOKIE_NAME]!.set({ ...cookieOptions, value: session });
        return { authenticated: true };
      },
      {
        params: InvitationParamsSchema,
        body: PhotoUploadSchema,
        response: apiResponse(t.Object({ authenticated: t.Boolean() })),
      },
    )
    .get(
      '/:token/content',
      ({ params, cookie }) =>
        input.access.content({
          token: params.token,
          session: cookie[GUEST_COOKIE_NAME]?.value as string | undefined,
        }),
      { params: InvitationParamsSchema, response: apiResponse(InvitationContentSchema) },
    )
    .put(
      '/:token/rsvp',
      ({ params, body, cookie }) =>
        input.access.rsvp({
          token: params.token,
          session: cookie[GUEST_COOKIE_NAME]?.value as string | undefined,
          ...body,
        }),
      {
        params: InvitationParamsSchema,
        body: RsvpSchema,
        response: apiResponse(InvitationContentSchema),
      },
    );
}
