import { useEffect, useId, useRef, useState } from 'react';

const photographs = [
  {
    file: 'archway',
    alt: 'Massimo and Elizaveta beneath a stone archway, with a bouquet of blue flowers',
    height: 1449,
  },
  {
    file: 'embrace',
    alt: 'Massimo holding Elizaveta close in front of an ornate iron gate',
    height: 1440,
  },
  {
    file: 'little-details',
    alt: 'A closer look at their rings, blue flowers and silver shoes on the white Vespa',
    height: 1440,
  },
  {
    file: 'vespa',
    alt: 'Massimo and Elizaveta laughing together on a white Vespa',
    height: 1440,
  },
  {
    file: 'just-us',
    alt: 'Elizaveta resting her hand on Massimo’s shoulder as they smile on the Vespa',
    height: 1448,
  },
];

export function PhotoAlbum() {
  const id = useId();
  const track = useRef<HTMLElement>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const element = track.current!;
    const update = () => {
      const center = element.scrollLeft + element.clientWidth / 2;
      const frames = Array.from(element.querySelectorAll<HTMLLIElement>('li'));
      const distances = frames.map((frame) =>
        Math.abs(frame.offsetLeft + frame.offsetWidth / 2 - center),
      );
      setCurrent(distances.indexOf(Math.min(...distances)));
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', update);
    };
  }, []);

  const show = (index: number) => {
    const element = track.current!;
    const frame = element.querySelectorAll<HTMLLIElement>('li')[index];
    if (!frame) {
      return;
    }
    element.scrollTo({
      left: frame.offsetLeft + frame.offsetWidth / 2 - element.clientWidth / 2,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  };

  return (
    <section className="photo-album" aria-labelledby={`${id}-heading`}>
      <header className="album-heading">
        <h2 id={`${id}-heading`}>A little of us</h2>
      </header>
      <section
        ref={track}
        id={`${id}-track`}
        className="album-track"
        aria-label="Our photographs"
        aria-describedby={`${id}-hint`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: The scrolling region must be keyboard accessible.
        tabIndex={0}
        onKeyDown={(event) => {
          const destinations: Record<string, number> = {
            ArrowLeft: current - 1,
            ArrowRight: current + 1,
            Home: 0,
            End: photographs.length - 1,
          };
          const destination = destinations[event.key];
          if (destination !== undefined) {
            event.preventDefault();
            show(destination);
          }
        }}
      >
        <ol className="album-photographs">
          {Array.from(photographs.entries()).map(([index, photo]) => (
            <li key={photo.file} className="album-frame" aria-current={index === current}>
              <figure>
                <img
                  src={`./media/album-${photo.file}.webp`}
                  srcSet={`./media/album-${photo.file}-480.webp 480w, ./media/album-${photo.file}.webp 960w`}
                  sizes="(max-width: 600px) 74vw, 352px"
                  alt={photo.alt}
                  width="960"
                  height={photo.height}
                  loading="lazy"
                  decoding="async"
                />
              </figure>
            </li>
          ))}
        </ol>
      </section>
      <footer className="album-footer">
        <p className="sr-only" id={`${id}-hint`}>
          Swipe or use the arrow keys to see more photographs.
        </p>
        <div className="album-controls">
          <button
            type="button"
            aria-label="Previous photograph"
            aria-controls={`${id}-track`}
            disabled={current === 0}
            onClick={() => show(current - 1)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M20 12H4m6-6-6 6 6 6" />
            </svg>
          </button>
          <p className="album-position" aria-live="polite" aria-atomic="true">
            <span className="sr-only">Photograph </span>
            {current + 1} <span aria-hidden="true">/</span>
            <span className="sr-only"> of </span> {photographs.length}
          </p>
          <button
            type="button"
            aria-label="Next photograph"
            aria-controls={`${id}-track`}
            disabled={current === photographs.length - 1}
            onClick={() => show(current + 1)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M4 12h16m-6-6 6 6-6 6" />
            </svg>
          </button>
        </div>
      </footer>
    </section>
  );
}
