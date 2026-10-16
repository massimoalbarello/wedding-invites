import { cn } from '@repo/ui/class-names';
import type { ReactNode } from 'react';

export function SecretScene({ children }: { children: ReactNode }) {
  return <main className="secret-entry">{children}</main>;
}

export function SecretPaper({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('secret-mail', className)}>
      <div className="secret-backing" aria-hidden="true" />
      <section className="secret-paper">{children}</section>
    </div>
  );
}

export function SecretStamp({ children }: { children: ReactNode }) {
  return <div className="secret-stamp">{children}</div>;
}

export function SecretSeal({ verified = false }: { verified?: boolean }) {
  return (
    <span className="secret-seal" data-verified={verified} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        {verified ? (
          <path d="m6 12 4 4 8-8" />
        ) : (
          <>
            <rect x="6.5" y="10" width="11" height="9" rx="2" />
            <path d="M9 10V7a3 3 0 0 1 6 0v3m-3 4v2" />
          </>
        )}
      </svg>
    </span>
  );
}

export function PersonalInvitationCover({ name }: { name: string }) {
  return (
    <SecretPaper>
      <div className="secret-topline">
        <p className="secret-eyebrow">For your eyes only</p>
        <SecretSeal />
      </div>
      <h1 className="secret-stamp">
        TOP
        <br />
        SECRET
      </h1>
      <div className="secret-recipient">
        <p>Intended recipient</p>
        <h2>{name}</h2>
      </div>
      <div className="secret-redacted" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </SecretPaper>
  );
}
