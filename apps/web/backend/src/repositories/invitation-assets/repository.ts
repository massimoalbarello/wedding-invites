import { getInvitationAssets } from '#backend/lib/assets.ts';
import {
  type InvitationPackage,
  PackageManifestSchema,
} from '#backend/models/invitation-designs/model.ts';

export interface InvitationAssetsRepositoryContract {
  list(): InvitationPackage[];
  get(input: { packageId: string; path: string }): Blob | null;
}
export class InvitationAssetsRepository implements InvitationAssetsRepositoryContract {
  private readonly assets: Map<string, Blob>;
  private readonly packages: InvitationPackage[];
  constructor() {
    this.assets = getInvitationAssets();
    this.packages = [];
  }
  async load() {
    for (const [path, blob] of this.assets) {
      const [, filename, ...nested] = path.split('/');
      if (filename !== 'manifest.json' || nested.length > 0) {
        continue;
      }
      const manifest = PackageManifestSchema.parse(JSON.parse(await blob.text()));
      if (path !== `${manifest.id}/manifest.json`) {
        throw new Error(`Invitation manifest does not match its package: ${path}`);
      }
      if (this.assets.has(`${manifest.id}/index.html`)) {
        this.packages.push(manifest);
      }
    }
    return this;
  }
  list() {
    return [...this.packages];
  }
  get(input: { packageId: string; path: string }) {
    return this.assets.get(`${input.packageId}/${input.path}`) ?? null;
  }
}
