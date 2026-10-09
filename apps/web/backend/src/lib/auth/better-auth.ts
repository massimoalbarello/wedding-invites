import { passkey } from '@better-auth/passkey';
import { bunSqlAdapter } from '@ilbertt/better-auth-bun-sql';
import { betterAuth } from 'better-auth';
import { APIError, getAuthoritativeSessionFromCtx } from 'better-auth/api';
import type { SQL } from 'bun';
import {
  OWNER_DISPLAY_NAME,
  OWNER_EMAIL,
  OWNER_USER_ID,
} from '#backend/lib/auth/owner-registration.ts';

export function createAuth(input: {
  database: SQL;
  baseUrl: URL;
  nibrunHostname?: string;
  secret: string;
}) {
  const rpUrl = input.nibrunHostname ? new URL(`https://${input.nibrunHostname}`) : input.baseUrl;
  const trustedOrigins = [...new Set([rpUrl.origin, input.baseUrl.origin])];
  const auth = betterAuth({
    database: bunSqlAdapter({ sql: input.database, tablesPrefix: 'auth_' }),
    baseURL: input.baseUrl.origin,
    basePath: '/api/auth',
    secret: input.secret,
    trustedOrigins,
    plugins: [
      passkey({
        rpID: rpUrl.hostname,
        rpName: OWNER_DISPLAY_NAME,
        origin: trustedOrigins,
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        registration: {
          requireSession: false,
          resolveUser: async ({ ctx }) => {
            const owner = await ctx.context.internalAdapter.findUserById(OWNER_USER_ID);
            if (owner) {
              throw APIError.from('FORBIDDEN', {
                code: 'OWNER_REGISTERED',
                message:
                  'This invitation dashboard already has an owner. Sign in to add another passkey.',
              });
            }
            return { id: OWNER_USER_ID, name: OWNER_USER_ID, displayName: OWNER_DISPLAY_NAME };
          },
          afterVerification: async ({ ctx, verification, user }) => {
            if (verification.registrationInfo?.userVerified !== true) {
              throw APIError.from('UNAUTHORIZED', {
                code: 'USER_VERIFICATION_REQUIRED',
                message: 'User verification is required.',
              });
            }
            if (user.id !== OWNER_USER_ID) {
              throw APIError.from('FORBIDDEN', {
                code: 'INVALID_OWNER',
                message: 'Invalid owner account.',
              });
            }
            const session = await getAuthoritativeSessionFromCtx(ctx);
            if (session) {
              if (session.user.id !== user.id) {
                throw APIError.from('FORBIDDEN', {
                  code: 'ACCOUNT_MISMATCH',
                  message: 'Account mismatch.',
                });
              }
              return { userId: session.user.id };
            }
            const owner = await ctx.context.internalAdapter.findUserById(OWNER_USER_ID);
            if (owner) {
              throw APIError.from('FORBIDDEN', {
                code: 'OWNER_REGISTERED',
                message: 'The dashboard already has an owner.',
              });
            }
            // A fixed primary key also prevents concurrent first-owner enrollments.
            await ctx.context.internalAdapter.createUser(
              {
                id: user.id,
                name: OWNER_DISPLAY_NAME,
                email: OWNER_EMAIL,
                emailVerified: false,
              },
              { method: 'passkey' },
            );
            return { userId: user.id };
          },
        },
        authentication: {
          afterVerification: ({ verification }) => {
            if (!verification.authenticationInfo.userVerified) {
              throw APIError.from('UNAUTHORIZED', {
                code: 'USER_VERIFICATION_REQUIRED',
                message: 'User verification is required.',
              });
            }
          },
        },
      }),
    ],
    advanced: { database: { generateId: () => Bun.randomUUIDv7() } },
  });
  return {
    handler: (request: Request) => auth.handler(request),
    getSession: async (input: { headers: Headers }) => {
      const session = await auth.api.getSession(input);
      return session?.user.id === OWNER_USER_ID ? session : null;
    },
  };
}
export type Auth = ReturnType<typeof createAuth>;
