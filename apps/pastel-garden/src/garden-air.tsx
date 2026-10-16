import { type CSSProperties, useEffect, useRef, useState } from 'react';

const VISIBLE_SCENE_THRESHOLD = 0.05;
const WINGBEAT_FRAME_WIDTH = 384;
const spriteHeights = { dove: 569, butterfly: 512 };
const flights = [
  { kind: 'butterfly', top: '28%', duration: 14, delay: -4, reverse: false },
  { kind: 'butterfly', top: '62%', duration: 18, delay: -12, reverse: true },
  { kind: 'butterfly', top: '80%', duration: 16, delay: -8, reverse: false },
  { kind: 'butterfly', top: '43%', duration: 20, delay: -15, reverse: true },
  {
    kind: 'dove',
    top: '14%',
    duration: 11,
    delay: -2,
    reverse: false,
    arc: '-8cqh',
    exit: '4cqh',
    wingbeat: '460ms',
    wingbeatDelay: '-120ms',
  },
  {
    kind: 'dove',
    top: '43%',
    duration: 16,
    delay: -9,
    reverse: true,
    arc: '13cqh',
    exit: '-7cqh',
    wingbeat: '530ms',
    wingbeatDelay: '-350ms',
  },
  {
    kind: 'dove',
    top: '76%',
    duration: 13,
    delay: -6,
    reverse: false,
    arc: '-11cqh',
    exit: '-17cqh',
    wingbeat: '410ms',
    wingbeatDelay: '-240ms',
  },
] as const;
const petals = {
  count: 14,
  spreadStep: 29,
  widthPercent: 100,
  baseSize: 18,
  variations: 4,
  sizeStep: 3,
  baseDuration: 11,
  durationStep: 2,
  staggerSeconds: 1.7,
  drift: 45,
};

export function GardenAir() {
  const air = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(Boolean(entry && entry.intersectionRatio >= VISIBLE_SCENE_THRESHOLD));
      },
      { threshold: VISIBLE_SCENE_THRESHOLD },
    );
    if (air.current) {
      observer.observe(air.current);
    }
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={air} className={visible ? 'garden-air is-in-view' : 'garden-air'} aria-hidden="true">
      <div className="garden-air-window">
        {[...Array.from({ length: petals.count }).keys()].map((seed) => (
          <span
            className="garden-petal"
            key={seed}
            style={
              {
                left: `${(seed * petals.spreadStep) % petals.widthPercent}%`,
                width: `${petals.baseSize + (seed % petals.variations) * petals.sizeStep}px`,
                '--duration': `${petals.baseDuration + (seed % petals.variations) * petals.durationStep}s`,
                '--delay': `${-seed * petals.staggerSeconds}s`,
                '--drift': `${seed % 2 === 0 ? petals.drift : -petals.drift}px`,
              } as CSSProperties
            }
          >
            <img src="./media/garden-petal.webp" alt="" width="96" height="96" loading="lazy" />
          </span>
        ))}
        {flights.map((flight) => (
          <span
            className={`garden-${flight.kind}`}
            data-reverse={flight.reverse}
            key={`${flight.kind}-${flight.top}`}
            style={
              {
                top: flight.top,
                aspectRatio: `${WINGBEAT_FRAME_WIDTH} / ${spriteHeights[flight.kind]}`,
                '--duration': `${flight.duration}s`,
                '--delay': `${flight.delay}s`,
                ...(flight.kind === 'dove' && {
                  '--flight-arc': flight.arc,
                  '--flight-exit': flight.exit,
                  '--wingbeat-duration': flight.wingbeat,
                  '--wingbeat-delay': flight.wingbeatDelay,
                }),
              } as CSSProperties
            }
          >
            <span className="garden-wingbeat">
              <img
                src={`./media/garden-${flight.kind}-flight.webp`}
                alt=""
                width="1536"
                height={spriteHeights[flight.kind]}
                loading="lazy"
              />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
