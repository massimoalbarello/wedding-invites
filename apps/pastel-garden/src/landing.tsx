import type { InvitationContext, InvitationRuntime } from '@repo/invitation-runtime/contract';
import { useEffect, useRef } from 'react';
import { content } from './content';
import { Countdown } from './countdown';
import { ReplySection } from './reply-section';

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
    <main className="letter" inert={!active} aria-hidden={!active}>
      <section className="hero" aria-label="Wedding invitation">
        <div className="portrait-art">
          <img ref={artwork} src="./media/landing.webp" alt="" width="720" height="1280" />
          <div className="hero-copy">
            <h1 ref={heading} tabIndex={-1} aria-label={content.nameLabel}>
              <span className="first-name">{content.names[0]}</span>{' '}
              <span className="second-name">&amp; {content.names[1]}</span>
            </h1>
            <p className="wedding-date">
              <time dateTime={content.date}>{content.dateLabel}</time>
            </p>
            <p className="wedding-venue">{content.venue}</p>
          </div>
        </div>
      </section>
      <section className="venue-section" id="venue" aria-labelledby="venue-heading">
        <div className="venue-copy">
          <p className="eyebrow">Our wedding</p>
          <h2 id="venue-heading">{content.venue}</h2>
          <img
            className="venue-artwork"
            src="./media/casiglio-venue.webp"
            alt="The pink villa of Castello di Casiglio, with the stone castle alongside it"
            width="1536"
            height="1024"
          />
          <time dateTime={content.date}>{content.dateLabel}</time>
          <p className="signature">{content.nameLabel}</p>
        </div>
      </section>
      <Countdown />
      <ReplySection runtime={runtime} context={context} />
    </main>
  );
}
