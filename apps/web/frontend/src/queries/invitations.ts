import { queryOptions } from '@tanstack/react-query';
import { api } from '../lib/api';

export const invitationKeys = {
  all: ['invitation'] as const,
  token: (token: string) => [...invitationKeys.all, token] as const,
  content: (token: string) => [...invitationKeys.token(token), 'content'] as const,
};
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const CONFLICT = 409;
export class InvitationAccessError extends Error {}
export function invitationEntryOptions(token: string) {
  return queryOptions({
    queryKey: [...invitationKeys.token(token), 'entry'],
    retry: false,
    queryFn: async () => {
      const result = await api.api.invitations({ token }).get();
      if (result.error) {
        throw new Error(
          'This personal link is unavailable. Please ask the person who sent it for a new one.',
        );
      }
      return result.data;
    },
  });
}
export function invitationContentOptions(token: string) {
  return queryOptions({
    queryKey: invitationKeys.content(token),
    retry: false,
    queryFn: async () => {
      const result = await api.api.invitations({ token }).content.get();
      if (result.error) {
        if (
          result.error.status === UNAUTHORIZED ||
          result.error.status === FORBIDDEN ||
          result.error.status === NOT_FOUND
        ) {
          return null;
        }
        if (result.error.status === CONFLICT) {
          return { notReady: true } as const;
        }
        throw new Error('Your invitation could not be loaded. Please try again.');
      }
      return result.data;
    },
  });
}
export async function openInvitation(token: string) {
  const result = await api.api.invitations({ token }).session.post();
  if (result.error) {
    throw new Error('Could not open your invitation. Please try your link again.');
  }
}
export async function verifyFace({ token, photo }: { token: string; photo: File }) {
  const result = await api.api.invitations({ token }).verify.post({ photo });
  if (result.error) {
    const value = result.error.value;
    throw new Error(
      typeof value === 'object' && value !== null && 'error' in value
        ? String(value.error)
        : 'We couldn’t confirm it’s you. Face the camera in good light and try again.',
    );
  }
}
export async function saveRsvp(input: {
  token: string;
  status: 'accepted' | 'declined';
  companions: string[];
}) {
  const result = await api.api
    .invitations({ token: input.token })
    .rsvp.put({ status: input.status, companions: input.companions });
  if (result.error) {
    if (
      result.error.status === UNAUTHORIZED ||
      result.error.status === FORBIDDEN ||
      result.error.status === NOT_FOUND
    ) {
      throw new InvitationAccessError(
        'Your session has ended. Open your personal link to verify again.',
      );
    }
    throw new Error('Could not save your reply. Check your guests’ names and try again.');
  }
  return result.data;
}
