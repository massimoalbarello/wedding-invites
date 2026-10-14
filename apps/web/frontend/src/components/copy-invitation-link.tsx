import { Button } from '@repo/ui/button';
import { useState } from 'react';

export function invitationUrl(token: string) {
  return `${window.location.origin}/i/${encodeURIComponent(token)}`;
}

export function CopyInvitationLink({ token, name }: { token: string; name: string }) {
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const labels = {
    idle: 'Invitation link',
    copying: 'Copying…',
    copied: 'Copied',
    error: 'Retry copy',
  };
  return (
    <Button
      variant="outline"
      className="min-w-36"
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
      <svg
        aria-hidden="true"
        data-icon="inline-end"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V4H4v12h4" />
      </svg>
    </Button>
  );
}
