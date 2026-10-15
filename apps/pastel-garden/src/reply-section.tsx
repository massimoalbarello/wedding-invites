import type { InvitationContext, InvitationRuntime } from '@repo/invitation-runtime/contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FloralFrame } from './floral-frame';
import { PetalCelebration } from './petal-celebration';
import { RsvpForm } from './rsvp-form';

export function ReplySection({
  runtime,
  context,
}: {
  runtime: InvitationRuntime;
  context: InvitationContext;
}) {
  const client = useQueryClient();
  const [celebrating, setCelebrating] = useState(false);
  const reply = useMutation({
    mutationFn: (value: Parameters<InvitationRuntime['saveRsvp']>[0]) => runtime.saveRsvp(value),
    onSuccess: (rsvp) => {
      client.setQueryData(['recipient-context'], { ...context, rsvp });
      setCelebrating(rsvp.status === 'accepted');
    },
    onMutate: () => setCelebrating(false),
  });
  return (
    <section className="reply-section floral-section" id="rsvp" aria-labelledby="reply-heading">
      <FloralFrame />
      {celebrating && <PetalCelebration onEnd={() => setCelebrating(false)} />}
      <div className="reply-copy">
        <p className="eyebrow">RSVP</p>
        <p className="recipient-name">
          This is a personal invitation for {context.recipient.name}.
        </p>
        <h2 id="reply-heading">Will you celebrate with us?</h2>
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
