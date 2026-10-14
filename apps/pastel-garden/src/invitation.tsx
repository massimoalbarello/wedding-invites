import type { InvitationRuntime } from '@repo/invitation-runtime/contract';
import { useQuery } from '@tanstack/react-query';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { FloralFrame, GardenScene, VenueArtwork } from './artwork';
import { content } from './content';
import { Countdown } from './countdown';
import { Envelope, OPENING_DURATION_MS } from './envelope';
import { ReplySection } from './reply-section';

const OPENING_FALLBACK_MARGIN_MS = 1000;

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
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      const finishWithReducedMotion = () => {
        if (media.matches) {
          setStage('open');
        }
      };
      finishWithReducedMotion();
      media.addEventListener('change', finishWithReducedMotion);
      const timeout = window.setTimeout(
        () => setStage('open'),
        OPENING_DURATION_MS + OPENING_FALLBACK_MARGIN_MS,
      );
      return () => {
        window.clearTimeout(timeout);
        media.removeEventListener('change', finishWithReducedMotion);
      };
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
        <>
          <main
            className={stage === 'opening' ? 'sealed-letter is-revealing' : 'sealed-letter'}
            aria-label="Sealed invitation"
            style={{ '--opening-duration': `${OPENING_DURATION_MS}ms` } as CSSProperties}
          >
            <div className="opening-light" aria-hidden="true">
              <span className="opening-halo" />
              <span className="opening-rays" />
              <span className="opening-wash" />
            </div>
            <div className="envelope-greeting">
              <p className="eyebrow">You are invited</p>
              {context.data && <p>A letter for {context.data.recipient.name}</p>}
            </div>
            <Envelope opening={stage === 'opening'} onOpened={() => setStage('open')} />
            <div className="envelope-actions">
              {stage === 'opening' && (
                <p className="opening-status" role="status">
                  Opening your invitation…
                </p>
              )}
              {context.isPending && <p role="status">Just a moment…</p>}
            </div>
          </main>
          <button
            className="entrance-trigger"
            type="button"
            aria-label="Open invitation"
            disabled={!context.data || stage !== 'closed'}
            onClick={() =>
              setStage((current) =>
                current === 'closed'
                  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
                    ? 'open'
                    : 'opening'
                  : current,
              )
            }
          />
        </>
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
