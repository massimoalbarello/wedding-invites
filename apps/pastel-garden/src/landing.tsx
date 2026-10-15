import type { InvitationContext, InvitationRuntime } from '@repo/invitation-runtime/contract';
import { useEffect, useRef, useState } from 'react';
import { content } from './content';
import { Countdown } from './countdown';
import { FloralFrame } from './floral-frame';
import { ReplySection } from './reply-section';

const VENUE_VISIBILITY_THRESHOLD = 0.05;

export function Landing({
  runtime,
  context,
  active,
  onReady,
}: {
  runtime: InvitationRuntime;
  context: InvitationContext;
  active: boolean;
  onReady: () => void;
}) {
  const artwork = useRef<HTMLImageElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const venue = useRef<HTMLElement>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  useEffect(() => {
    if (!active || !venue.current) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.intersectionRatio >= VENUE_VISIBILITY_THRESHOLD) {
          setHasScrolled(true);
          observer.disconnect();
        }
      },
      { threshold: VENUE_VISIBILITY_THRESHOLD },
    );
    observer.observe(venue.current);
    return () => observer.disconnect();
  }, [active]);
  useEffect(() => {
    let mounted = true;
    void Promise.all([artwork.current?.decode().catch(() => {}), document.fonts?.ready]).then(
      () => {
        if (mounted) {
          onReady();
        }
      },
    );
    return () => {
      mounted = false;
    };
  }, [onReady]);
  useEffect(() => {
    if (active) {
      heading.current?.focus({ preventScroll: true });
    }
  }, [active]);
  return (
    <main className={active ? 'letter is-active' : 'letter'} inert={!active} aria-hidden={!active}>
      <section className="hero" aria-label="Wedding invitation">
        <div className="portrait-art">
          <img
            ref={artwork}
            src="./media/landing-couple.webp"
            alt="Massimo and Elizaveta together in the flower-lined garden at Castello di Casiglio"
            width="720"
            height="1280"
          />
          <div className="hero-copy">
            <h1 ref={heading} tabIndex={-1} aria-label={content.nameLabel}>
              {content.names[0]} &amp; {content.names[1]}
            </h1>
            <p className="invitation-line">invite you to their wedding</p>
          </div>
        </div>
        {active && !hasScrolled && (
          <a className="scroll-hint" href="#venue">
            <span className="sr-only">Scroll to wedding details</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </a>
        )}
      </section>
      <section
        ref={venue}
        className="venue-section floral-section"
        id="venue"
        tabIndex={-1}
        aria-labelledby="venue-heading"
      >
        <FloralFrame />
        <div className="venue-copy">
          <p className="eyebrow">Where</p>
          <h2 id="venue-heading">{content.venue}</h2>
          <img
            className="venue-artwork"
            src="./media/casiglio-venue.webp"
            alt="The pink villa of Castello di Casiglio, with the stone castle alongside it"
            width="1536"
            height="1024"
          />
        </div>
      </section>
      <Countdown />
      <ReplySection runtime={runtime} context={context} />
    </main>
  );
}
