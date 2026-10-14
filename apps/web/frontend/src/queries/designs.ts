import { queryOptions } from '@tanstack/react-query';
import { api } from '../lib/api';

export const designKeys = { owner: (ownerId: string) => ['invitation-design', ownerId] as const };
export function designsOptions(ownerId: string) {
  return queryOptions({
    queryKey: designKeys.owner(ownerId),
    queryFn: async () => {
      const result = await api.api.admin.designs.get();
      if (result.error) {
        throw new Error('Could not load invitation designs. Please try again.');
      }
      return result.data;
    },
  });
}
export async function saveDesign(packageId: string) {
  const result = await api.api.admin.designs.put({ packageId });
  if (result.error) {
    throw new Error('Could not save the invitation design. Please try again.');
  }
  return result.data;
}
export function designPreviewUrl(packageId: string) {
  return `/api/admin/designs/${encodeURIComponent(packageId)}/assets/index.html`;
}
export type DesignCatalog = NonNullable<
  Awaited<ReturnType<typeof api.api.admin.designs.get>>['data']
>;
