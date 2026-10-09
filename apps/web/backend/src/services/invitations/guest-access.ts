import { createHash } from 'node:crypto';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '#backend/lib/errors.ts';
import { opaqueId } from '#backend/lib/opaque-id.ts';
import { compareFace } from '#backend/models/faces/comparison.ts';
import {
  type Guest,
  INVITATION_DATE,
  MAX_GUEST_NAME_LENGTH,
  MILLISECONDS_PER_SECOND,
  type RsvpStatus,
  SESSION_MAX_AGE_SECONDS,
} from '#backend/models/invitations/model.ts';
import type { FaceAnalyzer } from '#backend/repositories/faces/analyzer.ts';
import type { InvitationsRepositoryContract } from '#backend/repositories/invitations/repository.ts';
import { analyzePhoto, readPhoto } from '#backend/services/invitations/photos.ts';

function hashSession(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
function invitationContent(guest: Guest) {
  return {
    name: guest.name,
    date: INVITATION_DATE,
    coupleNames: 'Massimo & Liza',
    status: guest.status,
    maxGuests: guest.maxGuests,
    companions: guest.companions,
  };
}
export class GuestAccessService {
  constructor(
    private readonly input: { guests: InvitationsRepositoryContract; faces: FaceAnalyzer },
  ) {}
  private async guest(token: string) {
    const guest = await this.input.guests.byToken(token);
    if (!guest) {
      throw new NotFoundError();
    }
    return guest;
  }
  private async authenticated(input: { guest: Guest; session?: string }) {
    return Boolean(
      input.session &&
        (await this.input.guests.hasSession({
          ownerId: input.guest.ownerId,
          guestId: input.guest.id,
          tokenHash: hashSession(input.session),
          now: new Date().toISOString(),
        })),
    );
  }
  private async authorized(input: { token: string; session?: string }) {
    const guest = await this.guest(input.token);
    if (!(await this.authenticated({ guest, session: input.session }))) {
      throw new UnauthorizedError('Please verify your identity to open this invitation.');
    }
    return guest;
  }
  async entry(input: { token: string; session?: string }) {
    const guest = await this.guest(input.token);
    return {
      name: guest.name,
      faceScanRequired: guest.faceScanRequired,
      authenticated: await this.authenticated({ guest, session: input.session }),
    };
  }
  private async session(guest: Guest) {
    const token = opaqueId();
    const expiresAt = new Date(
      Date.now() + SESSION_MAX_AGE_SECONDS * MILLISECONDS_PER_SECOND,
    ).toISOString();
    const created = await this.input.guests.createSession({
      ownerId: guest.ownerId,
      guestId: guest.id,
      linkToken: guest.token,
      tokenHash: hashSession(token),
      expiresAt,
      faceScanRequired: guest.faceScanRequired,
    });
    if (!created) {
      throw new NotFoundError();
    }
    return token;
  }
  async bypass(token: string) {
    const guest = await this.guest(token);
    if (guest.faceScanRequired) {
      throw new ForbiddenError('This invitation requires a selfie.');
    }
    return this.session(guest);
  }
  async verify(input: { token: string; photo: File }) {
    const guest = await this.guest(input.token);
    if (!guest.faceScanRequired) {
      return this.session(guest);
    }
    const references = await this.input.guests.references({
      ownerId: guest.ownerId,
      guestId: guest.id,
    });
    if (!references.length) {
      throw new ConflictError(
        'This invitation is not ready yet. Please ask the sender to add a reference photo.',
      );
    }
    const { image } = await readPhoto(input.photo);
    const capture = await analyzePhoto({ faces: this.input.faces, ownerId: guest.ownerId, image });
    const comparisons = references.map(({ observation }) =>
      compareFace({ reference: observation, capture }),
    );
    if (comparisons.includes('duplicate')) {
      throw new ForbiddenError('That looks like a reference photo. Please take a fresh selfie.');
    }
    if (!comparisons.includes('match')) {
      throw new ForbiddenError('We could not match your face. Please try another selfie.');
    }
    return this.session(guest);
  }
  async content(input: { token: string; session?: string }) {
    return invitationContent(await this.authorized(input));
  }
  async rsvp(input: {
    token: string;
    session?: string;
    status: Exclude<RsvpStatus, 'pending'>;
    companions: string[];
  }) {
    const guest = await this.authorized(input);
    const names = input.status === 'accepted' ? input.companions.map((name) => name.trim()) : [];
    if (names.some((name) => !name || name.length > MAX_GUEST_NAME_LENGTH)) {
      throw new BadRequestError('Enter a name for each guest.');
    }
    if (names.length > guest.maxGuests) {
      throw new BadRequestError('This invitation does not allow that many guests.');
    }
    const saved = await this.input.guests.rsvp({
      ownerId: guest.ownerId,
      guestId: guest.id,
      linkToken: input.token,
      tokenHash: hashSession(input.session!),
      now: new Date().toISOString(),
      status: input.status,
      companions: names.map((name) => ({ id: opaqueId(), name })),
    });
    if (!saved) {
      await this.authorized(input);
      throw new ConflictError('The invitation changed. Please refresh and try again.');
    }
    return this.content(input);
  }
}
export type GuestAccessServiceContract = Pick<
  GuestAccessService,
  'entry' | 'bypass' | 'verify' | 'content' | 'rsvp'
>;
