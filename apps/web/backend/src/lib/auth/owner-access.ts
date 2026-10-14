import { OWNER_USER_ID } from '#backend/lib/auth/owner-registration.ts';
import { ForbiddenError } from '#backend/lib/errors.ts';
import type { Actor } from '#backend/models/auth/model.ts';

export function requireOwner(actor: Actor) {
  if (actor.userId !== OWNER_USER_ID) {
    throw new ForbiddenError();
  }
}
