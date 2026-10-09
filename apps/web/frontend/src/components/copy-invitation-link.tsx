import { Button } from '@repo/ui/button';
import { useState } from 'react';

export function invitationUrl(token: string) {
  return `${window.location.origin}/i/${encodeURIComponent(token)}`;
}

export function CopyInvitationLink({ token, name }: { token: string; name: string }) {
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const labels = { idle: 'Copy link', copying: 'Copying…', copied: 'Copied', error: 'Retry copy' };
  return (
    <Button
      variant="outline"
      className="min-w-22"
      aria-label={`Copy invitation link for ${name}`}
      title={status === 'error' ? 'Could not copy the link. Try again.' : undefined}
      disabled={status === 'copying'}
      onClick={async () => {
        setStatus('copying');
        try {
          await navigator.clipboard.writeText(invitationUrl(token));
          setStatus('copied');
        } catch {
          setStatus('error');
        }
      }}
    >
      <span aria-live="polite">{labels[status]}</span>
    </Button>
  );
}
