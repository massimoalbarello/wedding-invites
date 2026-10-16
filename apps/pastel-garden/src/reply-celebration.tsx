import confetti from 'canvas-confetti';
import { type RefObject, useEffect, useRef } from 'react';

// canvas-confetti consumes an affine array; its external types incorrectly declare DOMMatrix.
const shapeMatrix = [1, 0, 0, 1, 0, 0] as unknown as DOMMatrix;
const petalPath = 'M0 -5 C3 -5 5 -2 4 1 C3 4 0 5 -1 5 C-2 3 -5 1 -4 -2 C-3 -4 -1 -5 0 -5Z';

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
    const origin = {
      x: (button.left + button.width / 2 - bounds.left) / bounds.width,
      y: (button.top + button.height / 2 - bounds.top) / bounds.height,
    };
    const petal = confetti.shapeFromPath({ path: petalPath, matrix: shapeMatrix });
    const petals = launch({
      origin,
      particleCount: 105,
      angle: 90,
      spread: 110,
      startVelocity: 34,
      gravity: 0.65,
      decay: 0.93,
      ticks: 210,
      scalar: 1.65,
      colors: ['#fffdf7', '#fffdf7', '#f6eee1', '#e5e7eb'],
      shapes: [petal],
    });
    const pollen = launch({
      origin,
      particleCount: 12,
      angle: 90,
      spread: 125,
      startVelocity: 26,
      gravity: 0.8,
      decay: 0.92,
      ticks: 160,
      scalar: 0.55,
      colors: ['#b38b45', '#d5b975'],
      shapes: ['circle'],
    });
    void Promise.all([petals, pollen]).then(() => {
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
