import { useEffect, useRef } from 'react';

const CLEARING_SECONDS = 3.5;
const STALLED_PLAYBACK_TIMEOUT_MS = 10_000;

export function Envelope({ opening, onOpened }: { opening: boolean; onOpened: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const visual = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const player = video.current;
    if (!opening || !player) {
      return;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) {
      onOpened();
      return;
    }
    let timer = window.setTimeout(onOpened, STALLED_PLAYBACK_TIMEOUT_MS);
    let lastProgress = player.currentTime;
    const progress = () => {
      if (player.currentTime !== lastProgress) {
        lastProgress = player.currentTime;
        window.clearTimeout(timer);
        timer = window.setTimeout(onOpened, STALLED_PLAYBACK_TIMEOUT_MS);
      }
    };
    const motionChanged = () => {
      if (media.matches) {
        onOpened();
      }
    };
    let frame = 0;
    const draw = () => {
      if (visual.current && Number.isFinite(player.duration)) {
        const remaining = Math.max(
          0,
          Math.min(1, (player.duration - player.currentTime) / CLEARING_SECONDS),
        );
        // biome-ignore lint/style/noMagicNumbers: coefficients of the cubic smoothstep polynomial.
        visual.current.style.opacity = String(remaining * remaining * (3 - 2 * remaining));
      }
      frame = window.requestAnimationFrame(draw);
    };
    media.addEventListener('change', motionChanged);
    player.addEventListener('timeupdate', progress);
    frame = window.requestAnimationFrame(draw);
    void player.play().catch(onOpened);
    return () => {
      player.pause();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      player.removeEventListener('timeupdate', progress);
      media.removeEventListener('change', motionChanged);
    };
  }, [opening, onOpened]);
  return (
    <div ref={visual} className="intro-visual" aria-hidden="true">
      <div className="intro-frame">
        <video
          ref={video}
          src="./media/intro.mp4"
          poster="./media/opening-poster.webp"
          muted
          playsInline
          preload="auto"
          onEnded={opening ? onOpened : undefined}
          onError={opening ? onOpened : undefined}
          width="720"
          height="1280"
        />
      </div>
    </div>
  );
}
