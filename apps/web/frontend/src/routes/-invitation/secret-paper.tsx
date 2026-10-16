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

export function PrivateEnvelope({ verified = false }: { verified?: boolean }) {
  return (
    <div className="secret-envelope" aria-hidden="true">
      <svg viewBox="0 0 240 160" fill="none" aria-hidden="true">
        <path className="secret-envelope-body" d="M20 30h200v120H20z" />
        <path className="secret-envelope-fold" d="m20 150 100-78 100 78" />
        <path className="secret-envelope-flap" d="m20 30 100 78L220 30Z" />
        <path className="secret-envelope-edge" d="m20 30 100 78L220 30M20 150l72-56m128 56-72-56" />
      </svg>
      <span className="secret-seal">
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
      <span className="secret-spark secret-spark-left">✧</span>
      <span className="secret-spark secret-spark-right">✦</span>
    </div>
  );
}

export function PersonalInvitationCover({ name }: { name: string }) {
  return (
    <SecretPaper>
      <SecretStamp>Private & personal</SecretStamp>
      <PrivateEnvelope />
      <h1 className="secret-title">For your eyes only.</h1>
      <div className="secret-recipient">
        <p>A personal invitation for</p>
        <h2>{name}</h2>
      </div>
    </SecretPaper>
  );
}
