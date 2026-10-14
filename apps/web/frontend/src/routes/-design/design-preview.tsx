import type { InvitationContext } from '@repo/invitation-runtime/contract';
import { connectInvitationHost } from '@repo/invitation-runtime/host';
import { useEffect, useRef } from 'react';
import { designPreviewUrl } from '../../queries/designs';

export function DesignPreview({ packageId }: { packageId: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const context = useRef<InvitationContext>({
    recipient: { name: 'Preview guest' },
    rsvp: { status: 'pending', companions: [], maxAdditionalGuests: 1 },
  });
  useEffect(() => {
    if (!frame.current) {
      return;
    }
    return connectInvitationHost({
      window,
      frame: frame.current,
      runtime: {
        getContext: () => Promise.resolve(context.current),
        saveRsvp: (reply) => {
          context.current = { ...context.current, rsvp: { ...context.current.rsvp, ...reply } };
          return Promise.resolve(context.current.rsvp);
        },
      },
    });
  }, []);
  return (
    <section className="mt-7" aria-label="Design preview">
      <p className="mb-3 text-muted-foreground text-xs">
        Preview · Replies here are examples and won’t be saved.
      </p>
      <iframe
        ref={frame}
        title="Design preview"
        src={designPreviewUrl(packageId)}
        className="mx-auto block h-[42rem] w-full max-w-md rounded-xl border border-border"
        sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      />
    </section>
  );
}
