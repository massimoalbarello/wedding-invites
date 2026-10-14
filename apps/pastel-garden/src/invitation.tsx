import type { InvitationRuntime } from '@repo/invitation-runtime/contract';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { FloralFrame, GardenScene, VenueArtwork } from './artwork';
import { content } from './content';
import { Countdown } from './countdown';
import { Envelope } from './envelope';
import { ReplySection } from './reply-section';

const OPENING_TIMEOUT_MS = 3000;

export function Invitation({ runtime }: { runtime: InvitationRuntime }) {
  const context = useQuery({
    queryKey: ['recipient-context'],
    queryFn: () => runtime.getContext(),
  });
  const [stage, setStage] = useState<'closed' | 'opening' | 'open'>('closed');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (stage === 'open') {
      heading.current?.focus({ preventScroll: true });
    }
    if (stage === 'opening') {
      // Guarantee access even if a browser disables or interrupts CSS animation.
      const timeout = window.setTimeout(() => setStage('open'), OPENING_TIMEOUT_MS);
      return () => window.clearTimeout(timeout);
    }
  }, [stage]);

  if (context.error) {
    return (
      <main className="connection-error">
        <h1>This invitation couldn’t be opened</h1>
        <p role="alert">{context.error.message}</p>
        <button type="button" onClick={() => void context.refetch()}>
          Try again
        </button>
      </main>
    );
  }

  return (
    <div className="invitation">
      {stage !== 'open' ? (
        <main className="sealed-letter" aria-label="Sealed invitation">
          <div className="envelope-greeting">
            <p className="eyebrow">You are invited</p>
            {context.data && <p>A letter for {context.data.recipient.name}</p>}
          </div>
          <Envelope opening={stage === 'opening'} onOpened={() => setStage('open')} />
          <div className="envelope-actions">
            {stage === 'closed' ? (
              <button
                type="button"
                disabled={!context.data}
                onClick={() =>
                  setStage(
                    window.matchMedia('(prefers-reduced-motion: reduce)').matches
                      ? 'open'
                      : 'opening',
                  )
                }
              >
                {context.isPending ? 'Just a moment…' : 'Tap to open'}
              </button>
            ) : (
              <button type="button" onClick={() => setStage('open')}>
                Skip opening
              </button>
            )}
          </div>
        </main>
      ) : (
        <main className="letter">
          <FloralFrame />
          <section className="hero" aria-label="Wedding invitation">
            <div className="hero-copy">
              <p className="eyebrow">We’re getting married</p>
              <h1 ref={heading} tabIndex={-1} aria-label={content.nameLabel}>
                <span>{content.names[0]}</span> <span>&amp; {content.names[1]}</span>
              </h1>
              <p className="wedding-date">
                <time dateTime={content.date}>{content.dateLabel}</time>
              </p>
              <p className="wedding-venue">{content.venue}</p>
              <a className="garden-link" href="#venue">
                Into the garden <span aria-hidden="true">↓</span>
              </a>
            </div>
            <GardenScene />
          </section>
          <section className="venue-section" id="venue" aria-labelledby="venue-heading">
            <div className="venue-copy">
              <p className="eyebrow">Our wedding</p>
              <h2 id="venue-heading">{content.venue}</h2>
              <VenueArtwork />
              <time dateTime={content.date}>{content.dateLabel}</time>
              <p className="signature">{content.nameLabel}</p>
            </div>
          </section>
          <Countdown />
          {context.data && <ReplySection runtime={runtime} context={context.data} />}
        </main>
      )}
    </div>
  );
}
