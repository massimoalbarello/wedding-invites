import { type CSSProperties, useEffect, useRef } from 'react';

const blooms = [
  { id: 'arrival-left', side: 'left', top: '-1%', width: '76%', turn: 0, shape: 'corner' },
  { id: 'arrival-right', side: 'right', top: '4%', width: '68%', turn: -12, shape: 'corner' },
  { id: 'venue-left', side: 'left', top: '15%', width: '38%', turn: -8, shape: 'vine' },
  { id: 'venue-right', side: 'right', top: '23%', width: '74%', turn: 16, shape: 'corner' },
  { id: 'date-left', side: 'left', top: '34%', width: '72%', turn: -20, shape: 'corner' },
  { id: 'date-right', side: 'right', top: '40%', width: '40%', turn: 10, shape: 'vine' },
  { id: 'countdown-left', side: 'left', top: '52%', width: '74%', turn: 12, shape: 'corner' },
  { id: 'countdown-right', side: 'right', top: '60%', width: '70%', turn: -16, shape: 'corner' },
  { id: 'reply-left', side: 'left', top: '70%', width: '40%', turn: -10, shape: 'vine' },
  { id: 'reply-right', side: 'right', top: '77%', width: '74%', turn: 18, shape: 'corner' },
  { id: 'farewell-left', side: 'left', top: '88%', width: '70%', turn: -16, shape: 'corner' },
  { id: 'bluebells-left', side: 'left', top: '8%', width: '50%', turn: -32, shape: 'corner' },
  { id: 'peonies-right', side: 'right', top: '14%', width: '66%', turn: 24, shape: 'corner' },
  { id: 'blush-left', side: 'left', top: '26%', width: '64%', turn: 15, shape: 'corner' },
  { id: 'bluebells-right', side: 'right', top: '33%', width: '55%', turn: -28, shape: 'corner' },
  { id: 'ivory-left', side: 'left', top: '45%', width: '68%', turn: -26, shape: 'corner' },
  { id: 'blush-right', side: 'right', top: '53%', width: '62%', turn: 30, shape: 'corner' },
  { id: 'hydrangeas-left', side: 'left', top: '62%', width: '60%', turn: -18, shape: 'corner' },
  { id: 'ivory-right', side: 'right', top: '87%', width: '68%', turn: -24, shape: 'corner' },
  { id: 'farewell-right', side: 'right', top: '94%', width: '72%', turn: 0, shape: 'corner' },
] as const;
const artwork = {
  corner: { width: 1000, height: 1000 },
  vine: { width: 480, height: 1440 },
};
const BLOOM_TRAVEL_PX = 38;
const BLOOM_TURN_DEGREES = 4;
const BLOOM_SCALE_VARIATION = 0.08;

export function FloralFrame() {
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const garden = frame.current;
    if (!garden) {
      return;
    }
    const clusters = [...garden.querySelectorAll<HTMLElement>('.flower-cluster')];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let pendingFrame = 0;
    const reset = () => {
      for (const cluster of clusters) {
        cluster.style.removeProperty('--bloom-shift');
        cluster.style.removeProperty('--bloom-turn');
        cluster.style.removeProperty('--bloom-scale');
      }
    };
    const paint = () => {
      pendingFrame = 0;
      if (reducedMotion.matches) {
        reset();
        return;
      }
      const height = window.innerHeight;
      const bounds = garden.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > height) {
        return;
      }
      const progress = clusters.map((cluster) => {
        const bounds = cluster.getBoundingClientRect();
        return Math.max(-1, Math.min(1, (height / 2 - bounds.top) / height));
      });
      for (const [index, cluster] of clusters.entries()) {
        const offset = progress[index]!;
        const direction = index % 2 === 0 ? 1 : -1;
        cluster.style.setProperty('--bloom-shift', `${offset * BLOOM_TRAVEL_PX * direction}px`);
        cluster.style.setProperty('--bloom-turn', `${offset * BLOOM_TURN_DEGREES * direction}deg`);
        cluster.style.setProperty(
          '--bloom-scale',
          String(1 + (1 - Math.abs(offset)) * BLOOM_SCALE_VARIATION),
        );
      }
    };
    const schedule = () => {
      if (!pendingFrame) {
        pendingFrame = window.requestAnimationFrame(paint);
      }
    };
    schedule();
    const resize = new ResizeObserver(schedule);
    resize.observe(garden);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    reducedMotion.addEventListener('change', schedule);
    return () => {
      window.cancelAnimationFrame(pendingFrame);
      resize.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      reducedMotion.removeEventListener('change', schedule);
    };
  }, []);
  return (
    <div ref={frame} className="floral-frame" aria-hidden="true">
      {blooms.map((bloom) => (
        <div
          key={bloom.id}
          className={`flower-cluster flower-cluster-${bloom.side} flower-cluster-${bloom.shape}`}
          style={
            {
              top: bloom.top,
              width: bloom.width,
              '--base-turn': `${bloom.turn}deg`,
            } as CSSProperties
          }
        >
          <img
            src={`./media/garden-floral-${bloom.shape}.webp`}
            alt=""
            width={artwork[bloom.shape].width}
            height={artwork[bloom.shape].height}
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
}
