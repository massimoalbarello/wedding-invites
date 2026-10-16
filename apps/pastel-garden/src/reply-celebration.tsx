import confetti from 'canvas-confetti';
import { type RefObject, useEffect, useRef } from 'react';

export function ReplyCelebration({
  anchor,
  onEnd,
}: {
  anchor: RefObject<HTMLButtonElement | null>;
  onEnd: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const button = anchor.current?.getBoundingClientRect();
    if (!canvas.current || !button) {
      return;
    }
    const launch = confetti.create(canvas.current, { resize: true, disableForReducedMotion: true });
    const bounds = canvas.current.getBoundingClientRect();
    let active = true;
    const flight = launch({
      origin: {
        x: (button.left + button.width / 2 - bounds.left) / bounds.width,
        y: (button.top + button.height / 2 - bounds.top) / bounds.height,
      },
      particleCount: 240,
      angle: 90,
      spread: 130,
      startVelocity: 52,
      gravity: 1.15,
      decay: 0.91,
      ticks: 200,
      scalar: 1.15,
      colors: ['#f46991', '#ffbf45', '#67bdf4', '#a87ced', '#66caaa', '#fff2b8'],
      shapes: ['square', 'circle'],
    });
    void Promise.resolve(flight).then(() => {
      if (active) {
        onEnd();
      }
    });
    return () => {
      active = false;
      launch.reset();
    };
  }, [anchor, onEnd]);
  return <canvas ref={canvas} className="reply-celebration" aria-hidden="true" tabIndex={-1} />;
}
