import { getInvitationAssets } from '#backend/lib/assets.ts';

export interface InvitationAssetsRepositoryContract {
  get(path: string): Blob | null;
}

export class InvitationAssetsRepository implements InvitationAssetsRepositoryContract {
  private readonly assets: Map<string, Blob>;
  constructor(input: { packageId: string }) {
    this.assets = getInvitationAssets(input);
  }
  get(path: string) {
    return this.assets.get(path) ?? null;
  }
}
