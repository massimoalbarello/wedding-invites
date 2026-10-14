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
      <div className="envelope-back" />
      <div className="envelope-glow" />
      <div className="envelope-letter">
        <span>{content.nameLabel}</span>
        <span>{content.dateLabel}</span>
      </div>
      <div className="envelope-body" />
      <div className="envelope-flap" />
      <div className="envelope-sparkles">
        <span className="envelope-glint" />
        <span className="envelope-glint" />
        <span className="envelope-glint" />
        <span className="envelope-glint" />
        <span className="envelope-glint" />
      </div>
    </div>
  );
}
