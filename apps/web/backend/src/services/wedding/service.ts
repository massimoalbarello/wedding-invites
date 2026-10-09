import { requireOwner } from '#backend/lib/auth/owner-access.ts';
import { BadRequestError } from '#backend/lib/errors.ts';
import type { Actor } from '#backend/models/auth/model.ts';
import { type WeddingSettings, WeddingSettingsValidation } from '#backend/models/wedding/model.ts';
import type { WeddingRepositoryContract } from '#backend/repositories/wedding/repository.ts';

export class WeddingService {
  constructor(private readonly weddings: WeddingRepositoryContract) {}
  get({ actor }: { actor: Actor }) {
    requireOwner(actor);
    return this.weddings.get({ ownerId: actor.userId });
  }
  async save({ actor, settings }: { actor: Actor; settings: WeddingSettings }) {
    requireOwner(actor);
    const parsed = WeddingSettingsValidation.safeParse(settings);
    if (!parsed.success) {
      throw new BadRequestError('Enter the couple’s names and a valid wedding date.');
    }
    await this.weddings.save({ ownerId: actor.userId, settings: parsed.data });
    return parsed.data;
  }
}
export type WeddingServiceContract = Pick<WeddingService, 'get' | 'save'>;
