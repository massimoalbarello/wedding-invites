import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { api } from '../lib/api';

export type GuestFilters = {
  search?: string;
  status?: 'pending' | 'accepted' | 'declined';
  group?: string;
};
export const guestKeys = {
  owner: (ownerId: string) => ['guests', ownerId] as const,
  list: ({ ownerId, filters }: { ownerId: string; filters: GuestFilters }) =>
    [...guestKeys.owner(ownerId), 'list', filters] as const,
  detail: ({ ownerId, id }: { ownerId: string; id: string }) =>
    [...guestKeys.owner(ownerId), 'detail', id] as const,
};
export const ownerStatusOptions = queryOptions({
  queryKey: ['owner-status'],
  queryFn: async () => {
    const result = await api.api.admin.status.get();
    if (result.error) {
      throw new Error('Could not check dashboard access. Try again.');
    }
    return result.data;
  },
});
export function guestsOptions({ ownerId, filters }: { ownerId: string; filters: GuestFilters }) {
  return infiniteQueryOptions({
    queryKey: guestKeys.list({ ownerId, filters }),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const result = await api.api.admin.guests.get({
        query: { ...filters, cursor: pageParam, limit: 40 },
      });
      if (result.error) {
        throw new Error('Could not load the guest list. Try again.');
      }
      return result.data;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
export function statsOptions(ownerId: string) {
  return queryOptions({
    queryKey: [...guestKeys.owner(ownerId), 'stats'],
    queryFn: async () => {
      const result = await api.api.admin.stats.get();
      if (result.error) {
        throw new Error('Could not load invitation counts. Try again.');
      }
      return result.data;
    },
  });
}
export function groupsOptions(ownerId: string) {
  return queryOptions({
    queryKey: [...guestKeys.owner(ownerId), 'groups'],
    queryFn: async () => {
      const result = await api.api.admin.groups.get();
      if (result.error) {
        throw new Error('Could not load groups. Try again.');
      }
      return result.data;
    },
  });
}
export function guestOptions({ ownerId, id }: { ownerId: string; id: string }) {
  return queryOptions({
    queryKey: guestKeys.detail({ ownerId, id }),
    queryFn: async () => {
      const result = await api.api.admin.guests({ id }).get();
      if (result.error) {
        throw new Error('This guest could not be loaded. Return to the guest list and try again.');
      }
      return result.data;
    },
  });
}
export type GuestDraft = Parameters<typeof api.api.admin.guests.post>[0];
export async function createGuest(input: GuestDraft) {
  const result = await api.api.admin.guests.post(input);
  if (result.error) {
    throw new Error('Could not add this guest. Check their name and guest allowance.');
  }
  return result.data;
}
export async function updateGuest({ id, input }: { id: string; input: GuestDraft }) {
  const result = await api.api.admin.guests({ id }).patch(input);
  if (result.error) {
    throw new Error(
      'Could not save changes. The guest allowance must cover their existing companions.',
    );
  }
  return result.data;
}
export async function uploadReference({ id, photo }: { id: string; photo: File }) {
  const result = await api.api.admin.guests({ id }).photos.post({ photo });
  if (result.error) {
    const value = result.error.value;
    throw new Error(
      typeof value === 'object' && value !== null && 'error' in value
        ? String(value.error)
        : 'Use a clear photo with exactly one face and try again.',
    );
  }
  return result.data;
}
export async function removeReference({ id, photoId }: { id: string; photoId: string }) {
  const result = await api.api.admin.guests({ id }).photos({ photoId }).delete();
  if (result.error) {
    throw new Error('Could not remove the reference photo. Try again.');
  }
}
export function referenceUrl({ id, photoId }: { id: string; photoId: string }) {
  return `/api/admin/guests/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`;
}
export async function rotateInvitation(id: string) {
  const result = await api.api.admin.guests({ id }).rotate.post();
  if (result.error) {
    throw new Error('Could not replace this invitation link. Try again.');
  }
  return result.data;
}
export async function setGuestAccess({ id, active }: { id: string; active: boolean }) {
  const result = await api.api.admin.guests({ id }).access.post({ active });
  if (result.error) {
    throw new Error('Could not change invitation access. Try again.');
  }
  return result.data;
}
export async function revokeGuestSessions(id: string) {
  const result = await api.api.admin.guests({ id }).sessions.delete();
  if (result.error) {
    throw new Error('Could not sign this guest out. Try again.');
  }
}

export type Guest = NonNullable<
  Awaited<ReturnType<typeof api.api.admin.guests.get>>['data']
>['items'][number];
