import { useEffect, useState } from 'react';
import { content } from './content';

const MILLISECONDS_PER_DAY = 86_400_000;
const REFRESH_INTERVAL_MS = 60_000;
const italyDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Rome',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function daysUntilWedding(now: Date) {
  const parts = italyDate.formatToParts(now);
  const part = (name: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((value) => value.type === name)!.value);
  const today = Date.UTC(part('year'), part('month') - 1, part('day'));
  const [year, month, day] = content.date.split('-').map(Number) as [number, number, number];
  return Math.max(0, (Date.UTC(year, month - 1, day) - today) / MILLISECONDS_PER_DAY);
}

export function Countdown() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);
  const days = daysUntilWedding(now);
  return (
    <section className="countdown-section" aria-labelledby="countdown-heading">
      <div className="countdown-copy">
        <p className="eyebrow">{content.dateLabel}</p>
        <h2 id="countdown-heading">We’re counting the days</h2>
        <p className="countdown-number">{days}</p>
        <p>
          {days === 0
            ? 'Our wedding date has arrived'
            : `${days === 1 ? 'day' : 'days'} until our wedding`}
        </p>
        <p className="countdown-note">Counting calendar days in Italy.</p>
        <a className="garden-link" href="#rsvp">
          Send your reply <span aria-hidden="true">↓</span>
        </a>
      </div>
    </section>
  );
}
