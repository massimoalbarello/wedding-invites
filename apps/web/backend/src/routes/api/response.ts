import type { TSchema } from 'elysia';
import { ErrorResponseSchema } from '#backend/lib/errors.ts';
export function apiResponse<T extends TSchema>(success: T) {
  return {
    200: success,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
    403: ErrorResponseSchema,
    404: ErrorResponseSchema,
    409: ErrorResponseSchema,
    503: ErrorResponseSchema,
  };
}
