import type { CSSProperties } from 'react';

const motion = {
  count: 128,
  spreadStep: 37,
  widthPercent: 100,
  driftStep: 29,
  driftRange: 120,
  driftOffset: 60,
  staggerCount: 7,
  staggerSeconds: 0.14,
  clockwise: 280,
  counterclockwise: -240,
  baseSize: 20,
  variations: 4,
  sizeStep: 4,
  baseDuration: 4.6,
  durationStep: 0.4,
};

export function PetalCelebration({ onEnd }: { onEnd: () => void }) {
  return (
    <div
      className="petal-celebration"
      aria-hidden="true"
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) {
          onEnd();
        }
      }}
    >
      {[...Array.from({ length: motion.count }).keys()].map((seed) => (
        <img
          src="./media/garden-petal.webp"
          alt=""
          width="96"
          height="96"
          key={seed}
          style={
            {
              '--x': `${(seed * motion.spreadStep) % motion.widthPercent}%`,
              '--drift': `${((seed * motion.driftStep) % motion.driftRange) - motion.driftOffset}px`,
              '--delay': `${(seed % motion.staggerCount) * motion.staggerSeconds}s`,
              '--turn': `${seed % 2 === 0 ? motion.clockwise : motion.counterclockwise}deg`,
              '--size': `${motion.baseSize + (seed % motion.variations) * motion.sizeStep}px`,
              '--duration': `${motion.baseDuration + (seed % motion.variations) * motion.durationStep}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
