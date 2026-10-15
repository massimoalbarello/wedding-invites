import { content } from './content';

export const OPENING_DURATION_MS = 4200;

export function Envelope({ opening, onOpened }: { opening: boolean; onOpened: () => void }) {
  return (
    <div
      className={opening ? 'envelope-art is-opening' : 'envelope-art'}
      aria-hidden="true"
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === 'envelope-depart') {
          onOpened();
        }
      }}
    >
      <div className="envelope-letter">
        <span>{content.nameLabel}</span>
        <span>{content.dateLabel}</span>
      </div>
      <div className="envelope-panel envelope-bottom" />
      <div className="envelope-panel envelope-left" />
      <div className="envelope-panel envelope-right" />
      <div className="envelope-panel envelope-flap">
        <span className="envelope-seal" />
      </div>
    </div>
  );
}
