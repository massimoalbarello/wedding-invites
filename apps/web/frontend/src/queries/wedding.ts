import { queryOptions } from '@tanstack/react-query';
import { api } from '../lib/api';

export const weddingKeys = { owner: (ownerId: string) => ['wedding', ownerId] as const };
export function weddingOptions(ownerId: string) {
  return queryOptions({
    queryKey: weddingKeys.owner(ownerId),
    queryFn: async () => {
      const result = await api.api.admin.wedding.get();
      if (result.error) {
        throw new Error('Could not load your wedding details. Please try again.');
      }
      return result.data;
    },
  });
}
export type WeddingSettings = Parameters<typeof api.api.admin.wedding.put>[0];
export async function saveWedding(settings: WeddingSettings) {
  const result = await api.api.admin.wedding.put(settings);
  if (result.error) {
    throw new Error(
      'Could not save your wedding. Enter the couple’s names and a valid ceremony date.',
    );
  }
  return result.data;
}
