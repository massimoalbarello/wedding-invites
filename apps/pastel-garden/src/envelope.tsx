import { useEffect, useRef } from 'react';

export const OPENING_DURATION_MS = 8000;

export function Envelope({ opening, onOpened }: { opening: boolean; onOpened: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const player = video.current;
    if (!opening || !player) {
      return;
    }
    void player.play().catch(onOpened);
    return () => player.pause();
  }, [opening, onOpened]);
  return (
    <div className="portrait-art" aria-hidden="true">
      <video
        ref={video}
        src="./media/opening.mp4"
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
  );
}
