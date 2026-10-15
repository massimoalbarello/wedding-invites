import { useCallback, useEffect, useRef, useState } from 'react';

const PLAYBACK_STALL_TIMEOUT_MS = 8000;

function playbackWasInterrupted(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function Envelope({ opening, onOpened }: { opening: boolean; onOpened: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stallTimer = useRef<number | undefined>(undefined);
  const lastProgress = useRef(0);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const clearStallTimer = useCallback(() => {
    window.clearTimeout(stallTimer.current);
    stallTimer.current = undefined;
  }, []);
  const waitForPlayback = useCallback(() => {
    if (stallTimer.current !== undefined) {
      return;
    }
    stallTimer.current = window.setTimeout(onOpened, PLAYBACK_STALL_TIMEOUT_MS);
  }, [onOpened]);

  useEffect(() => {
    const player = video.current;
    if (!opening || !player) {
      return;
    }
    let active = true;
    waitForPlayback();
    void player.play().catch((error: unknown) => {
      if (!active) {
        return;
      }
      if (playbackWasInterrupted(error)) {
        clearStallTimer();
        return;
      }
      // Some mobile browsers permit inline playback only when it starts muted.
      player.muted = true;
      setMuted(true);
      void player.play().catch((retryError: unknown) => {
        if (active && !playbackWasInterrupted(retryError)) {
          onOpened();
        }
      });
    });
    return () => {
      active = false;
      clearStallTimer();
      player.pause();
    };
  }, [opening, onOpened, waitForPlayback, clearStallTimer]);

  return (
    <>
      <div className="portrait-art">
        <video
          ref={video}
          src="./media/our-story-opening.mp4"
          poster="./media/opening-poster.webp"
          muted={muted}
          playsInline
          preload="metadata"
          aria-label="Our wedding invitation, from a spinning embrace to Castello di Casiglio"
          onEnded={opening ? onOpened : undefined}
          onError={opening ? onOpened : undefined}
          onWaiting={opening && !paused ? waitForPlayback : undefined}
          onStalled={opening && !paused ? waitForPlayback : undefined}
          onPlaying={() => {
            clearStallTimer();
            setPaused(false);
          }}
          onPause={() => {
            clearStallTimer();
            setPaused(true);
          }}
          onTimeUpdate={(event) => {
            if (event.currentTarget.currentTime !== lastProgress.current) {
              lastProgress.current = event.currentTarget.currentTime;
              clearStallTimer();
            }
          }}
          width="720"
          height="1280"
        />
      </div>
      {opening && (
        <fieldset className="opening-controls">
          <legend className="sr-only">Film controls</legend>
          <button
            type="button"
            aria-label={paused ? 'Play our story' : 'Pause our story'}
            onClick={() => {
              const player = video.current;
              if (!player) {
                return;
              }
              if (player.paused) {
                waitForPlayback();
                void player.play().catch((error: unknown) => {
                  if (!playbackWasInterrupted(error)) {
                    onOpened();
                  }
                });
              } else {
                player.pause();
              }
            }}
          >
            {paused ? 'Play' : 'Pause'}
          </button>
          <button
            type="button"
            aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
            aria-pressed={!muted}
            onClick={() => setMuted((current) => !current)}
          >
            {muted ? 'Sound off' : 'Sound on'}
          </button>
          <button type="button" onClick={onOpened}>
            View invitation
          </button>
        </fieldset>
      )}
    </>
  );
}
