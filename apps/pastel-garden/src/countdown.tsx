import { useEffect, useState } from 'react';
import { content } from './content';

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

export function timeUntilWedding(now: Date) {
  const totalSeconds = Math.max(
    0,
    Math.ceil((Date.parse(content.startsAt) - now.getTime()) / MILLISECONDS_PER_SECOND),
  );
  return {
    days: Math.floor(totalSeconds / SECONDS_PER_DAY),
    hours: Math.floor((totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR),
    minutes: Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
    seconds: totalSeconds % SECONDS_PER_MINUTE,
  };
}

export function Countdown() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), MILLISECONDS_PER_SECOND);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = timeUntilWedding(now);
  const arrived = Object.values(remaining).every((value) => value === 0);
  return (
    <section className="countdown-section" aria-labelledby="countdown-heading">
      <div className="countdown-copy">
        <p className="eyebrow">When</p>
        <h2 id="countdown-heading">
          <time dateTime={content.date}>{content.dateLabel}</time>
        </h2>
        <p>
          <time dateTime={content.startsAt}>{content.timeLabel}</time>
        </p>
        <p className="countdown-intro">The countdown has begun</p>
        <dl className="countdown-clock" aria-label="Time until our wedding" aria-live="off">
          {Object.entries(remaining).map(([unit, value]) => (
            <div key={unit}>
              <dt>{unit}</dt>
              <dd>{String(value).padStart(2, '0')}</dd>
            </div>
          ))}
        </dl>
        {arrived && <p className="wedding-day">It’s time to celebrate!</p>}
      </div>
    </section>
  );
}
