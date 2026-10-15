import { useEffect, useRef, useState } from 'react';

const VISIBLE_SCENE_THRESHOLD = 0.05;

export function GardenAir() {
  const air = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(Boolean(entry && entry.intersectionRatio >= VISIBLE_SCENE_THRESHOLD));
      },
      { threshold: VISIBLE_SCENE_THRESHOLD },
    );
    if (air.current) {
      observer.observe(air.current);
    }
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={air} className={visible ? 'garden-air is-in-view' : 'garden-air'} aria-hidden="true">
      <div className="garden-air-window">
        {['first', 'second', 'third', 'fourth'].map((petal) => (
          <span className={`garden-petal garden-petal-${petal}`} key={petal}>
            <img src="./media/garden-petal.webp" alt="" width="96" height="96" loading="lazy" />
          </span>
        ))}
        <span className="garden-butterfly">
          <img src="./media/garden-butterfly.webp" alt="" width="192" height="192" loading="lazy" />
        </span>
        <span className="garden-dove">
          <img src="./media/garden-dove.webp" alt="" width="192" height="192" loading="lazy" />
        </span>
      </div>
    </div>
  );
}
