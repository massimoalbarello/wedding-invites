import { type CSSProperties, useEffect, useRef, useState } from 'react';

const VISIBLE_SCENE_THRESHOLD = 0.05;
const flights = [
  { kind: 'butterfly', top: '28%', duration: 17, delay: -4, reverse: false },
  { kind: 'butterfly', top: '62%', duration: 22, delay: -14, reverse: true },
  { kind: 'butterfly', top: '80%', duration: 19, delay: -10, reverse: false },
  { kind: 'butterfly', top: '43%', duration: 24, delay: -19, reverse: true },
  { kind: 'dove', top: '12%', duration: 21, delay: -7, reverse: false },
  { kind: 'dove', top: '18%', duration: 21, delay: -6, reverse: false },
  { kind: 'dove', top: '72%', duration: 27, delay: -20, reverse: true },
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
                '--duration': `${flight.duration}s`,
                '--delay': `${flight.delay}s`,
              } as CSSProperties
            }
          >
            <img
              src={`./media/garden-${flight.kind}.webp`}
              alt=""
              width="192"
              height="192"
              loading="lazy"
            />
          </span>
        ))}
      </div>
    </div>
  );
}
