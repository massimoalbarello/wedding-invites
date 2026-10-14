import { z } from 'zod';

const MAX_PACKAGE_NAME_LENGTH = 80;
const MAX_PACKAGE_DESCRIPTION_LENGTH = 240;
export const PACKAGE_ID_PATTERN = '^[a-z0-9]+(?:-[a-z0-9]+)*$';
export const PackageManifestSchema = z.object({
  id: z.string().regex(new RegExp(PACKAGE_ID_PATTERN)),
  name: z.string().trim().min(1).max(MAX_PACKAGE_NAME_LENGTH),
  description: z.string().trim().max(MAX_PACKAGE_DESCRIPTION_LENGTH),
});
export type InvitationPackage = z.infer<typeof PackageManifestSchema>;
