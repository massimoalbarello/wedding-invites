import { t } from 'elysia';
import { PACKAGE_ID_PATTERN } from '#backend/models/invitation-designs/model.ts';

export const PackageIdSchema = t.String({ pattern: PACKAGE_ID_PATTERN });
export const PackageSelectionSchema = t.Object({ packageId: PackageIdSchema });
export const DesignCatalogSchema = t.Object({
  selectedPackageId: t.String(),
  packages: t.Array(t.Object({ id: PackageIdSchema, name: t.String(), description: t.String() })),
});
