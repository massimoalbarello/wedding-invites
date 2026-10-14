import type { InvitationContext } from '@repo/invitation-runtime/contract';
import { connectInvitationHost } from '@repo/invitation-runtime/host';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import {
  InvitationAccessError,
  invitationContentOptions,
  invitationKeys,
  saveRsvp,
} from '../queries/invitations';

export const Route = createFileRoute('/i/$token/invitation')({
  loader: async ({ context, params }) => {
    const invitation = await context.queryClient.fetchQuery(invitationContentOptions(params.token));
    if (!invitation) {
      throw redirect({ to: '/i/$token', params: { token: params.token } });
    }
  },
  component: Invitation,
});

function Invitation() {
  const { token } = Route.useParams();
  const client = useQueryClient();
  const frame = useRef<HTMLIFrameElement>(null);
  const { data: invitation } = useSuspenseQuery(invitationContentOptions(token));
  const reply = useMutation({
    mutationFn: saveRsvp,
    onSuccess: (data) => client.setQueryData(invitationKeys.content(token), data),
    onError: (error) => {
      if (error instanceof InvitationAccessError) {
        client.setQueryData(invitationKeys.content(token), null);
      }
    },
  });
  const save = reply.mutateAsync;
  const assetUrl = invitation && !('notReady' in invitation) ? invitation.assetUrl : null;
  useEffect(() => {
    if (!frame.current || !assetUrl) {
      return;
    }
    return connectInvitationHost({
      window,
      frame: frame.current,
      runtime: {
        getContext: async () => {
          const content = await client.fetchQuery(invitationContentOptions(token));
          if (!content || 'notReady' in content) {
            throw new InvitationAccessError('Open your personal link again to continue.');
          }
          return invitationContext(content);
        },
        saveRsvp: async (value) => invitationContext(await save({ token, ...value })).rsvp,
      },
    });
  }, [assetUrl, client, token, save]);
  if (!invitation) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12 text-center">
        <h1 className="font-semibold text-2xl">Please open your personal link again</h1>
        <p className="mt-4 text-muted-foreground">
          Your session has ended or this invitation is no longer available.
        </p>
        <Link
          to="/i/$token"
          params={{ token }}
          className="mt-6 text-sm underline underline-offset-4"
        >
          Open personal link
        </Link>
      </main>
    );
  }
  if ('notReady' in invitation) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12 text-center">
        <h1 className="font-semibold text-2xl">This invitation is not ready yet.</h1>
        <p className="mt-4 text-muted-foreground">Please try again later.</p>
      </main>
    );
  }
  return (
    <iframe
      ref={frame}
      title="Invitation"
      src={invitation.assetUrl}
      className="block h-dvh w-full border-0"
      sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
    />
  );
}

function invitationContext(content: {
  name: string;
  status: InvitationContext['rsvp']['status'];
  companions: { name: string }[];
  maxGuests: number;
}): InvitationContext {
  return {
    recipient: { name: content.name },
    rsvp: {
      status: content.status,
      companions: content.companions.map((guest) => guest.name),
      maxAdditionalGuests: content.maxGuests,
    },
  };
}
