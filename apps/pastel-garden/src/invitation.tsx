import type { InvitationRuntime } from '@repo/invitation-runtime/contract';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { Envelope } from './envelope';
import { Landing } from './landing';

export function Invitation({ runtime }: { runtime: InvitationRuntime }) {
  const context = useQuery({
    queryKey: ['recipient-context'],
    queryFn: () => runtime.getContext(),
  });
  const [stage, setStage] = useState<'closed' | 'opening' | 'open'>('closed');
  const finishOpening = useCallback(() => setStage('open'), []);
  const [landingReady, setLandingReady] = useState(false);
  const ready = useCallback(() => setLandingReady(true), []);
  useEffect(() => {
    if (stage === 'opening') {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      const finishWithReducedMotion = () => {
        if (media.matches) {
          setStage('open');
        }
      };
      finishWithReducedMotion();
      media.addEventListener('change', finishWithReducedMotion);
      return () => {
        media.removeEventListener('change', finishWithReducedMotion);
      };
    }
  }, [stage]);

  if (context.error) {
    return (
      <main className="connection-error">
        <h1>This invitation couldn’t be opened</h1>
        <p role="alert">{context.error.message}</p>
        <button type="button" onClick={() => void context.refetch()}>
          Try again
        </button>
      </main>
    );
  }

  return (
    <div className={stage === 'open' ? 'invitation' : 'invitation is-sealed'}>
      {context.data && (
        <Landing
          runtime={runtime}
          context={context.data}
          active={stage === 'open'}
          onReady={ready}
        />
      )}
      {stage !== 'open' && (
        <main
          className="sealed-letter"
          aria-label={stage === 'opening' ? 'Our story' : 'Sealed invitation'}
        >
          <div className="sr-only">
            <p className="eyebrow">You are invited</p>
            {context.data && <p>A letter for {context.data.recipient.name}</p>}
          </div>
          <Envelope
            opening={stage === 'opening'}
            ready={Boolean(context.data) && landingReady}
            onOpened={finishOpening}
            onOpening={() => setStage('opening')}
          />
          <div className="sr-only">
            {stage === 'opening' && <p role="status">Our story is playing…</p>}
            {(context.isPending || !landingReady) && <p role="status">Just a moment…</p>}
          </div>
        </main>
      )}
    </div>
  );
}
