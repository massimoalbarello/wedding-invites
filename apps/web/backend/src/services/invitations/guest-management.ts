import { OWNER_USER_ID } from '#backend/lib/auth/owner-registration.ts';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '#backend/lib/errors.ts';
import { opaqueId } from '#backend/lib/opaque-id.ts';
import {
  type Actor,
  DEFAULT_PAGE_SIZE,
  type Guest,
  type GuestListInput,
  type GuestSettings,
  MAX_COMPANIONS,
  MAX_GROUP_NAME_LENGTH,
  MAX_GUEST_NAME_LENGTH,
  MAX_PAGE_SIZE,
  MAX_REFERENCE_PHOTOS,
} from '#backend/models/invitations/model.ts';
import type { AdminRepositoryContract } from '#backend/repositories/admin/repository.ts';
import type { FaceAnalyzer } from '#backend/repositories/faces/analyzer.ts';
import type { InvitationsRepositoryContract } from '#backend/repositories/invitations/repository.ts';
import { analyzePhoto, readPhoto } from '#backend/services/invitations/photos.ts';

export function requireOwner(actor: Actor) {
  if (actor.userId !== OWNER_USER_ID) {
    throw new ForbiddenError();
  }
}
export function publicGuest(guest: Guest) {
  return {
    id: guest.publicId,
    name: guest.name,
    groupName: guest.groupName,
    faceScanRequired: guest.faceScanRequired,
    maxGuests: guest.maxGuests,
    token: guest.token,
    status: guest.status,
    active: guest.active,
    createdAt: guest.createdAt,
    companions: guest.companions,
    references: guest.references,
  };
}
function normalizedSettings(settings: GuestSettings): GuestSettings {
  const name = settings.name.trim();
  const groupName = settings.groupName.trim();
  if (!name || name.length > MAX_GUEST_NAME_LENGTH || groupName.length > MAX_GROUP_NAME_LENGTH) {
    throw new BadRequestError('Enter a valid name and group.');
  }
  if (
    !Number.isInteger(settings.maxGuests) ||
    settings.maxGuests < 0 ||
    settings.maxGuests > MAX_COMPANIONS
  ) {
    throw new BadRequestError('Choose a valid guest allowance.');
  }
  return { ...settings, name, groupName };
}
export class GuestManagementService {
  constructor(
    private readonly input: {
      guests: InvitationsRepositoryContract;
      admin: AdminRepositoryContract;
      faces: FaceAnalyzer;
    },
  ) {}
  async status() {
    return { hasOwner: await this.input.admin.hasOwner() };
  }
  async list(input: { actor: Actor } & Partial<GuestListInput>) {
    requireOwner(input.actor);
    const limit = Math.min(input.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const guests = await this.input.guests.list({
      ...input,
      ownerId: input.actor.userId,
      limit: limit + 1,
    });
    const hasMore = guests.length > limit;
    const items = guests.slice(0, limit);
    return { items: items.map(publicGuest), nextCursor: hasMore ? items.at(-1)!.publicId : null };
  }
  stats({ actor }: { actor: Actor }) {
    requireOwner(actor);
    return this.input.guests.stats(actor.userId);
  }
  groups({ actor }: { actor: Actor }) {
    requireOwner(actor);
    return this.input.guests.groups(actor.userId);
  }
  async find({ actor, id }: { actor: Actor; id: string }) {
    requireOwner(actor);
    const guest = await this.input.guests.get({ ownerId: actor.userId, publicId: id });
    if (!guest) {
      throw new NotFoundError();
    }
    return guest;
  }
  async get(input: { actor: Actor; id: string }) {
    return publicGuest(await this.find(input));
  }
  async create({ actor, settings }: { actor: Actor; settings: GuestSettings }) {
    requireOwner(actor);
    const guest: Guest = {
      ...normalizedSettings(settings),
      id: crypto.randomUUID(),
      publicId: Bun.randomUUIDv7(),
      ownerId: actor.userId,
      token: opaqueId(),
      status: 'pending',
      active: true,
      createdAt: new Date().toISOString(),
      companions: [],
      references: [],
    };
    await this.input.guests.create(guest);
    return publicGuest(guest);
  }
  async update(input: { actor: Actor; id: string; settings: GuestSettings }) {
    const guest = await this.find(input);
    if (
      !(await this.input.guests.update({
        ownerId: guest.ownerId,
        guestId: guest.id,
        settings: normalizedSettings(input.settings),
      }))
    ) {
      throw new ConflictError(
        'The guest allowance cannot be smaller than the guests already added.',
      );
    }
    return this.get(input);
  }
  async setAccess(input: { actor: Actor; id: string; active: boolean }) {
    const guest = await this.find(input);
    await this.input.guests.setAccess({
      ownerId: guest.ownerId,
      guestId: guest.id,
      active: input.active,
    });
    return this.get(input);
  }
  async rotate(input: { actor: Actor; id: string }) {
    const guest = await this.find(input);
    await this.input.guests.rotate({
      ownerId: guest.ownerId,
      guestId: guest.id,
      token: opaqueId(),
    });
    return this.get(input);
  }
  async revokeSessions(input: { actor: Actor; id: string }) {
    const guest = await this.find(input);
    await this.input.guests.revokeSessions({ ownerId: guest.ownerId, guestId: guest.id });
    return { revoked: true };
  }
  async addPhoto(input: { actor: Actor; id: string; photo: File }) {
    const guest = await this.find(input);
    if (guest.references.length >= MAX_REFERENCE_PHOTOS) {
      throw new ConflictError(`A guest can have up to ${MAX_REFERENCE_PHOTOS} reference photos.`);
    }
    const photo = await readPhoto(input.photo);
    const observation = await analyzePhoto({
      faces: this.input.faces,
      ownerId: guest.ownerId,
      image: photo.image,
    });
    const added = await this.input.guests.addReference({
      ownerId: guest.ownerId,
      guestId: guest.id,
      id: opaqueId(),
      ...photo,
      observation,
      createdAt: new Date().toISOString(),
    });
    if (!added) {
      throw new ConflictError(`A guest can have up to ${MAX_REFERENCE_PHOTOS} reference photos.`);
    }
    return this.get(input);
  }
  async photo(input: { actor: Actor; id: string; photoId: string }) {
    const guest = await this.find(input);
    const photo = await this.input.guests.referenceImage({
      ownerId: guest.ownerId,
      guestId: guest.id,
      id: input.photoId,
    });
    if (!photo) {
      throw new NotFoundError();
    }
    return photo;
  }
  async removePhoto(input: { actor: Actor; id: string; photoId: string }) {
    const guest = await this.find(input);
    if (
      !(await this.input.guests.removeReference({
        ownerId: guest.ownerId,
        guestId: guest.id,
        id: input.photoId,
      }))
    ) {
      throw new NotFoundError();
    }
    return this.get(input);
  }
}
export type GuestManagementServiceContract = Pick<
  GuestManagementService,
  | 'status'
  | 'list'
  | 'stats'
  | 'groups'
  | 'get'
  | 'create'
  | 'update'
  | 'setAccess'
  | 'rotate'
  | 'revokeSessions'
  | 'addPhoto'
  | 'photo'
  | 'removePhoto'
>;
