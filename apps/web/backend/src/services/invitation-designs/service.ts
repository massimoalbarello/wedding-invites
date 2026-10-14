import { requireOwner } from '#backend/lib/auth/owner-access.ts';
import { NotFoundError } from '#backend/lib/errors.ts';
import type { Actor } from '#backend/models/auth/model.ts';
import type { InvitationAssetsRepositoryContract } from '#backend/repositories/invitation-assets/repository.ts';
import type { InvitationDesignsRepositoryContract } from '#backend/repositories/invitation-designs/repository.ts';

export class InvitationDesignService {
  constructor(
    private readonly input: {
      assets: InvitationAssetsRepositoryContract;
      designs: InvitationDesignsRepositoryContract;
    },
  ) {}
  async list(input: { actor: Actor }) {
    requireOwner(input.actor);
    return {
      selectedPackageId: await this.input.designs.get({ ownerId: input.actor.userId }),
      packages: this.input.assets.list(),
    };
  }
  async select(input: { actor: Actor; packageId: string }) {
    requireOwner(input.actor);
    if (!this.input.assets.list().some((entry) => entry.id === input.packageId)) {
      throw new NotFoundError('This invitation design is unavailable.');
    }
    await this.input.designs.save({ ownerId: input.actor.userId, packageId: input.packageId });
    return this.list(input);
  }
  asset(input: { actor: Actor; packageId: string; path: string }) {
    requireOwner(input.actor);
    if (!this.input.assets.list().some((entry) => entry.id === input.packageId)) {
      throw new NotFoundError();
    }
    const asset = this.input.assets.get(input);
    if (!asset) {
      throw new NotFoundError();
    }
    return asset;
  }
}
export type InvitationDesignServiceContract = Pick<
  InvitationDesignService,
  'list' | 'select' | 'asset'
>;
