import type { CSSProperties } from 'react';

const motion = {
  count: 28,
  spreadStep: 37,
  widthPercent: 100,
  driftStep: 29,
  driftRange: 160,
  driftOffset: 80,
  staggerCount: 7,
  staggerSeconds: 0.14,
  clockwise: 280,
  counterclockwise: -240,
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
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
