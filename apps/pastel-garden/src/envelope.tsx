import { useCallback, useEffect, useRef, useState } from 'react';

const SOUND_HINT_DURATION_SECONDS = 6;
const PLAYBACK_STALL_TIMEOUT_MS = 8000;

function playbackWasInterrupted(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function MusicSymbol({ muted }: { muted: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 5 5 9H2v6h3l5 4Z" />
      {muted ? (
        <path d="m15 9 6 6m0-6-6 6" />
      ) : (
        <g className="sound-waves">
          <path d="M14 8a6 6 0 0 1 0 8" />
          <path d="M17 4a11 11 0 0 1 0 16" />
        </g>
      )}
    </svg>
  );
}

export function Envelope({
  opening,
  ready,
  onOpened,
  onOpening,
}: {
  opening: boolean;
  ready: boolean;
  onOpened: () => void;
  onOpening: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stallTimer = useRef<number | undefined>(undefined);
  const lastProgress = useRef(0);
  const mounted = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [soundHintVisible, setSoundHintVisible] = useState(true);
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
    mounted.current = true;
    const player = video.current;
    return () => {
      mounted.current = false;
      clearStallTimer();
      player?.pause();
    };
  }, [clearStallTimer]);

  const open = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onOpened();
      return;
    }
    const player = video.current;
    if (!player) {
      return;
    }
    onOpening();
    waitForPlayback();
    // Keep play in the click handler so audible playback retains the user gesture.
    void player.play().catch((error: unknown) => {
      if (!mounted.current) {
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
        if (mounted.current && !playbackWasInterrupted(retryError)) {
          onOpened();
        }
      });
    });
  };

  return (
    <>
      <div className="portrait-art">
        <video
          ref={video}
          src="./media/our-story-opening.mp4"
          poster="./media/opening-poster.webp"
          muted={muted}
          playsInline
          preload="auto"
          aria-label="Our wedding invitation, from a spinning embrace to Castello di Casiglio"
          onEnded={opening ? onOpened : undefined}
          onError={opening ? onOpened : undefined}
          onWaiting={opening && !paused ? waitForPlayback : undefined}
          onStalled={opening && !paused ? waitForPlayback : undefined}
          onPlaying={() => {
            clearStallTimer();
            setPlaying(true);
            setPaused(false);
          }}
          onPause={() => {
            clearStallTimer();
            setPaused(true);
          }}
          onTimeUpdate={(event) => {
            if (event.currentTarget.currentTime >= SOUND_HINT_DURATION_SECONDS) {
              setSoundHintVisible(false);
            }
            if (event.currentTarget.currentTime !== lastProgress.current) {
              lastProgress.current = event.currentTarget.currentTime;
              clearStallTimer();
            }
          }}
          width="720"
          height="1280"
        />
        {!playing && (
          <img
            className="envelope-poster"
            src="./media/opening-poster.webp"
            alt=""
            width="720"
            height="1280"
          />
        )}
        {ready && !opening && <span className="seal-hint" aria-hidden="true" />}
        {opening && (muted || soundHintVisible) && (
          <div className="sound-hint">
            {muted ? (
              <button
                type="button"
                aria-label="Enable music"
                onClick={() => {
                  if (video.current) {
                    video.current.muted = false;
                    setMuted(false);
                  }
                }}
              >
                <MusicSymbol muted />
              </button>
            ) : (
              <span
                className="sound-icon"
                role="img"
                aria-label="Music is playing — turn up your volume"
              >
                <MusicSymbol muted={false} />
              </span>
            )}
          </div>
        )}
      </div>
      {!opening && (
        <button
          className="entrance-trigger"
          type="button"
          aria-label="Open invitation"
          disabled={!ready}
          onClick={open}
        />
      )}
    </>
  );
}
