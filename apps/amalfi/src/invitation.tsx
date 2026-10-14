import type { InvitationRuntime } from '@repo/invitation-runtime/contract';
import { Button } from '@repo/ui/button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { content } from './content';
import { RsvpForm } from './rsvp-form';

const CONTEXT_KEY = ['recipient-context'] as const;
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

export function Invitation({ runtime }: { runtime: InvitationRuntime }) {
  const context = useQuery({ queryKey: CONTEXT_KEY, queryFn: () => runtime.getContext() });
  const [stage, setStage] = useState<'closed' | 'opening' | 'open'>('closed');
  const [music, setMusic] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (stage === 'open') {
      heading.current?.focus({ preventScroll: true });
    }
  }, [stage]);
  const open = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStage('open');
      return;
    }
    setStage('opening');
    void video.current?.play().catch(() => setStage('open'));
  };
  const toggleMusic = () => {
    if (music) {
      audio.current?.pause();
      setMusic(false);
    } else {
      void audio.current
        ?.play()
        .then(() => setMusic(true))
        .catch(() => setMusic(false));
    }
  };
  if (context.error) {
    return (
      <main className="connection-error">
        <h1>This message couldn’t be opened</h1>
        <p role="alert">{context.error.message}</p>
        <Button
          onClick={() => {
            void context.refetch();
          }}
        >
          Try again
        </Button>
      </main>
    );
  }
  return (
    <div className="invitation">
      {/* biome-ignore lint/a11y/useMediaCaption: instrumental background music has no spoken content. */}
      <audio
        ref={audio}
        src="./media/music-amalfi.m4a"
        loop
        preload="none"
        aria-label="Background music"
      />
      {stage !== 'open' ? (
        <main className="envelope" aria-label="Sealed invitation">
          <video
            ref={video}
            className="envelope-film"
            poster="./media/envelope-poster.jpg"
            src="./media/envelope.mp4"
            muted
            playsInline
            preload="none"
            onEnded={() => setStage('open')}
            onError={() => {
              if (stage === 'opening') {
                setStage('open');
              }
            }}
          />
          <p className="eyebrow envelope-heading">You are invited</p>
          {context.data && (
            <p className="envelope-recipient">A letter for {context.data.recipient.name}</p>
          )}
          <div className="envelope-actions">
            {stage === 'closed' ? (
              <Button className="open-button" onClick={open} disabled={!context.data}>
                {context.isPending ? 'Just a moment…' : 'Tap to open'}
              </Button>
            ) : (
              <Button className="open-button" onClick={() => setStage('open')}>
                Skip opening
              </Button>
            )}
          </div>
        </main>
      ) : (
        <main className="letter">
          <section className="hero" aria-label="Wedding invitation">
            <div className="lemon-corner corner-left" aria-hidden="true" />
            <div className="lemon-corner corner-right" aria-hidden="true" />
            <div className="hero-copy">
              <p className="eyebrow">Together with their families</p>
              <h1
                ref={heading}
                tabIndex={-1}
                aria-label={`${content.names[0]} & ${content.names[1]}`}
              >
                <span>{content.names[0]}</span>
                <span className="ampersand">&</span>
                <span>{content.names[1]}</span>
              </h1>
              <p className="hero-invitation">invite you to celebrate their wedding</p>
              <span className="gold-rule" aria-hidden="true" />
              <p className="date">{content.dateLabel}</p>
              <p className="eyebrow location">{content.place}</p>
            </div>
            <div className="lemon-foreground" aria-hidden="true" />
            <div className="petals" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <a className="scroll-cue eyebrow" href="#welcome">
              Scroll to discover ↓
            </a>
          </section>
          <section className="welcome cream" id="welcome">
            <p className="eyebrow">With full hearts</p>
            <p className="welcome-copy">
              We would love you to join us by the sea, raise a glass beneath the lemon trees, and
              dance into the night. Bring your favourite memories and help us make a few more.
            </p>
            <p className="signature">{content.names.join(' & ')}</p>
          </section>
          <Section label="Save the date" title="The day is getting closer" tone="green">
            <Countdown />
            <p>We’re counting the days until we’re all together.</p>
            <a className="gold-button" href={calendarUrl()} download="celebration.ics">
              Add our day to your calendar
            </a>
          </Section>
          <Section label="Our story" title="A story by the sea" tone="blue">
            <p>
              A chance conversation on a ferry became our first summer together. Since then, this
              coast has been our favourite place to return. Now we’re coming back for a new
              beginning, with all our favourite people.
            </p>
            <img
              className="story-photo"
              src="./media/couple-4-granita-cafe.webp"
              alt="Elena and Marco laughing over a lemon granita above the sea"
              loading="lazy"
              width="640"
              height="800"
            />
          </Section>
          <Section label="Order of the day" title={content.dayLabel} tone="cream">
            <ol className="schedule">
              {content.schedule.map((event) => (
                <li key={event.time}>
                  <p className="schedule-title">
                    <span>{event.time}</span> · {event.title}
                  </p>
                  <p>{event.detail}</p>
                </li>
              ))}
            </ol>
            <img
              className="divider"
              src="./media/divider.webp"
              alt=""
              loading="lazy"
              width="640"
              height="160"
            />
          </Section>
          <Section label="The venue" title="Villa Limonaia" tone="green">
            <p className="eyebrow">Via Positanesi d’America 12 · Positano</p>
            <img
              className="venue-photo"
              src="./media/village.webp"
              alt="A coastal villa above Positano"
              loading="lazy"
              width="640"
              height="480"
            />
            <a
              className="gold-button"
              href="https://maps.google.com/?q=Positano%2C%20Italy"
              target="_blank"
              rel="noreferrer"
            >
              Get directions ↗
            </a>
            <p>
              Our shuttle leaves the main square at 3:15 PM and returns when the party finishes.
            </p>
          </Section>
          <Section label="Dress code" title="Beach formal" tone="blue">
            <p>
              Think summer tailoring, soft coastal colours, and comfortable shoes for the terraces.
              Dress up, but leave room for dancing.
            </p>
            <div className="dresscode">
              <img
                src="./media/beach-formal-w.webp"
                alt="Flowing dresses in seafoam, sand and coral"
                loading="lazy"
                width="320"
                height="400"
              />
              <img
                src="./media/beach-formal-m.webp"
                alt="Linen suits in white, sand and sky blue"
                loading="lazy"
                width="320"
                height="400"
              />
            </div>
            <div
              className="swatches"
              role="img"
              aria-label="Suggested colors: seafoam, sand, coral, sky blue and cream"
            >
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </Section>
          <Section label="Getting there & staying" title="Sleep by the sea" tone="cream">
            <ul className="places">
              <li>
                <h3>Le Sirenuse</h3>
                <p className="eyebrow">Positano · 5 min walk</p>
              </li>
              <li>
                <h3>Hotel Poseidon</h3>
                <p className="eyebrow">Positano · 8 min walk</p>
              </li>
              <li>
                <h3>Casa Angelina</h3>
                <p className="eyebrow">Praiano · 15 min by car</p>
              </li>
            </ul>
          </Section>
          <Section label="Things to do" title="While you’re here" tone="blue">
            <ul className="places">
              <li>
                <h3>Boat day to Capri</h3>
                <p>Take the morning ferry for a day of bright blue water and island wandering.</p>
              </li>
              <li>
                <h3>Path of the Gods</h3>
                <p>
                  Follow the trail above the coast for breathtaking views. Start early and bring
                  water.
                </p>
              </li>
              <li>
                <h3>Lemon granita at the pier</h3>
                <p>Find a shady spot by the harbour and try our favourite afternoon treat.</p>
              </li>
            </ul>
          </Section>
          <Section label="Gifts" tone="green">
            <p>
              Sharing this day with you means more to us than anything. Come ready to celebrate;
              your company is the gift we’re looking forward to.
            </p>
          </Section>
          <Section label="Elena & Marco" tone="cream">
            <Gallery />
          </Section>
          {context.data && <ReplySection runtime={runtime} context={context.data} />}
          <Section label="Good to know" tone="blue">
            <div className="faq">
              {content.faq.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </Section>
          <footer>
            <p className="signature">E & M</p>
            <p className="eyebrow">{content.dateLabel} · Positano</p>
          </footer>
          <a className="floating-rsvp" href="#rsvp">
            RSVP
          </a>
          <Button
            className="music-toggle"
            onClick={toggleMusic}
            aria-label={music ? 'Turn the music off' : 'Turn the music on'}
            aria-pressed={music}
          >
            {music ? '♫' : '♪'}
          </Button>
        </main>
      )}
    </div>
  );
}

function Section({
  label,
  title,
  tone,
  children,
}: {
  label: string;
  title?: string;
  tone: 'cream' | 'green' | 'blue';
  children: ReactNode;
}) {
  return (
    <section className={`section ${tone}`}>
      <p className="eyebrow">{label}</p>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}

function Countdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MILLISECONDS_PER_SECOND);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(
    0,
    Math.floor((Date.parse(content.startsAt) - now) / MILLISECONDS_PER_SECOND),
  );
  const values = [
    ['Days', Math.floor(seconds / (SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY))],
    ['Hours', Math.floor(seconds / (SECONDS_PER_MINUTE * MINUTES_PER_HOUR)) % HOURS_PER_DAY],
    ['Minutes', Math.floor(seconds / SECONDS_PER_MINUTE) % MINUTES_PER_HOUR],
    ['Seconds', seconds % SECONDS_PER_MINUTE],
  ] as const;
  return (
    <section className="countdown" aria-label="Time until the wedding">
      {values.map(([label, value]) => (
        <div key={label}>
          <span className="countdown-number">{String(value).padStart(2, '0')}</span>
          <span className="eyebrow">{label}</span>
        </div>
      ))}
    </section>
  );
}

function Gallery() {
  const [selected, setSelected] = useState<(typeof content.gallery)[number] | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (selected) {
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
    }
  }, [selected]);
  return (
    <>
      <div className="gallery">
        {content.gallery.map((photo) => (
          <button
            key={photo.src}
            type="button"
            aria-label={`Enlarge: ${photo.alt}`}
            onClick={() => setSelected(photo)}
          >
            <img
              src={`./media/${photo.src}`}
              alt={photo.alt}
              loading="lazy"
              width="320"
              height="400"
            />
          </button>
        ))}
      </div>
      <p className="photo-hint">Tap any photo to see it bigger.</p>
      <dialog ref={dialog} className="photo-dialog" onClose={() => setSelected(null)}>
        {selected && (
          <>
            <img src={`./media/${selected.src}`} alt={selected.alt} />
            <Button onClick={() => setSelected(null)} aria-label="Close photo">
              Close ×
            </Button>
          </>
        )}
      </dialog>
    </>
  );
}

function ReplySection({
  runtime,
  context,
}: {
  runtime: InvitationRuntime;
  context: Awaited<ReturnType<InvitationRuntime['getContext']>>;
}) {
  const client = useQueryClient();
  const reply = useMutation({
    mutationFn: runtime.saveRsvp,
    onSuccess: (rsvp) => client.setQueryData(CONTEXT_KEY, { ...context, rsvp }),
  });
  return (
    <section id="rsvp" className="section green rsvp-section">
      <p className="eyebrow">RSVP</p>
      <h2>Will you join us?</h2>
      <p>Kindly reply by {content.replyBy}</p>
      <p className="recipient-name">A personal invitation for {context.recipient.name}</p>
      {reply.isSuccess && (
        <p className="reply-confirmation" role="status">
          {context.rsvp.status === 'accepted'
            ? 'You’re on the list. We can’t wait to see you!'
            : 'Thank you for letting us know. You’ll be missed.'}
        </p>
      )}
      <RsvpForm
        key={`${context.rsvp.status}:${context.rsvp.companions.join('|')}`}
        status={context.rsvp.status}
        companions={context.rsvp.companions.map((name) => ({ name }))}
        maxGuests={context.rsvp.maxAdditionalGuests}
        onSave={async (value) => {
          try {
            await reply.mutateAsync(value);
          } catch {
            /* The mutation displays the error and preserves the draft. */
          }
        }}
      />
      {reply.error && (
        <p role="alert" className="reply-error">
          {reply.error.message}
        </p>
      )}
    </section>
  );
}

function calendarUrl() {
  const stamp = (date: string) =>
    new Date(date).toISOString().replace(/[-:]/g, '').replace('.000', '');
  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Invitation//Amalfi//EN',
    'BEGIN:VEVENT',
    'UID:amalfi-celebration-2027',
    `DTSTAMP:${stamp(content.startsAt)}`,
    `DTSTART:${stamp(content.startsAt)}`,
    `DTEND:${stamp(content.endsAt)}`,
    `SUMMARY:${content.names.join(' & ')} — Wedding celebration`,
    'LOCATION:Positano\\, Italy',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(calendar)}`;
}
