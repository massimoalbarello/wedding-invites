import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import {
  InvitationAccessError,
  invitationContentOptions,
  invitationKeys,
  saveRsvp,
} from '../queries/invitations';
import { RsvpForm } from './-invitation/rsvp-form';

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
  const { data: invitation } = useSuspenseQuery(invitationContentOptions(token));
  const reply = useMutation({
    mutationFn: saveRsvp,
    onSuccess: (data) => {
      client.setQueryData(invitationKeys.content(token), data);
    },
    onError: (error) => {
      if (error instanceof InvitationAccessError) {
        client.setQueryData(invitationKeys.content(token), null);
      }
    },
  });
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
  return (
    <main className="mx-auto max-w-lg px-6 py-16 sm:py-24">
      <p className="text-muted-foreground text-sm">You’re invited</p>
      <h1 className="mt-3 font-semibold text-4xl tracking-tight">{invitation.coupleNames}</h1>
      <p className="mt-3 text-lg">
        {new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(
          new Date(`${invitation.date}T12:00:00Z`),
        )}
      </p>
      <p className="mt-8 text-muted-foreground">
        {invitation.name}, we’d love you to celebrate with us.
      </p>
      <section className="mt-10 border-border border-t pt-8" aria-label="Your reply">
        {reply.isSuccess && (
          <p role="status" className="mb-6 rounded-xl bg-muted px-4 py-3 text-sm">
            {invitation.status === 'accepted'
              ? 'You’re on the list. We can’t wait to see you!'
              : 'Thank you for letting us know. You’ll be missed.'}
          </p>
        )}
        <RsvpForm
          key={`${invitation.status}:${invitation.companions.map((guest) => guest.name).join('|')}`}
          status={invitation.status}
          companions={invitation.companions}
          maxGuests={invitation.maxGuests}
          onSave={async (value) => {
            try {
              await reply.mutateAsync({ token, ...value });
            } catch {
              /* The mutation owns its visible error state. */
            }
          }}
        />
        {reply.error && (
          <p role="alert" className="mt-5 text-destructive text-sm">
            {reply.error.message}
            {reply.error instanceof InvitationAccessError && (
              <Link to="/i/$token" params={{ token }} className="ml-1 underline">
                Open your personal link
              </Link>
            )}
          </p>
        )}
      </section>
    </main>
  );
}
