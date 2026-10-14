import type { InvitationContext, InvitationRuntime } from '@repo/invitation-runtime/contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RsvpForm } from './rsvp-form';

export function ReplySection({
  runtime,
  context,
}: {
  runtime: InvitationRuntime;
  context: InvitationContext;
}) {
  const client = useQueryClient();
  const reply = useMutation({
    mutationFn: (value: Parameters<InvitationRuntime['saveRsvp']>[0]) => runtime.saveRsvp(value),
    onSuccess: (rsvp) => client.setQueryData(['recipient-context'], { ...context, rsvp }),
  });
  return (
    <section className="reply-section" id="rsvp" aria-labelledby="reply-heading">
      <div className="reply-copy">
        <p className="eyebrow">RSVP</p>
        <h2 id="reply-heading">Celebrate with us</h2>
        <p className="recipient-name">A personal invitation for {context.recipient.name}</p>
        <RsvpForm
          key={`${context.rsvp.status}:${context.rsvp.companions.join('|')}`}
          status={context.rsvp.status}
          companions={context.rsvp.companions.map((name) => ({ name }))}
          maxGuests={context.rsvp.maxAdditionalGuests}
          onSave={async (value) => {
            try {
              await reply.mutateAsync(value);
            } catch {
              // Keep the guest’s draft intact while displaying the runtime error below.
            }
          }}
        />
        {reply.isSuccess && (
          <p className="reply-confirmation" role="status">
            {reply.data?.status === 'accepted'
              ? 'Your reply is saved. We can’t wait to see you!'
              : 'Thank you for letting us know.'}
          </p>
        )}
        {reply.error && (
          <p className="reply-error" role="alert">
            {reply.error.message}
          </p>
        )}
      </div>
    </section>
  );
}
